import os
import json
import time
from datetime import datetime
from typing import Generator, Dict, Any, List, Tuple, Optional
from pymongo import MongoClient
from bson.objectid import ObjectId
from ollama import GenerateResponse

from cenacellm.settings.clients import ollama as api, mongo_uri, db_name
from cenacellm.tools.assistant import Assistant
from cenacellm.types import (
    LLMError,
    CallMetadata,
    call_metadata,
    Question,
    Chunks,
)

class OllamaAssistant(Assistant):
    def __init__(self):
        self.model = "gemma3:4b"
        self.memory_window_size = 5

        self.mongo_uri = mongo_uri
        self.db_name = db_name
        self.collection_name = "conversations" # Changed to conversations
        self.collection_backup_name = "user_histories_backup" # Kept for backup if needed

        self.client = MongoClient(self.mongo_uri)
        self.db = self.client[self.db_name]
        self.collection = self.db[self.collection_name]
        self.collection_backup = self.db[self.collection_backup_name]

        # Create indexes for efficient querying
        self.collection.create_index([("user_id", 1), ("conversation_id", 1)])
        self.collection.create_index([("user_id", 1), ("messages.id", 1)]) # For updating specific messages


    def load_history(self, user_id: str, conversation_id: str) -> list:
        """Carga el historial de chat de una conversación específica para un usuario."""
        doc = self.collection.find_one({"user_id": user_id, "conversation_id": conversation_id})
        return doc["messages"] if doc and "messages" in doc else []

    def save_history(self, user_id: str, conversation_id: str, history: list, conversation_title: Optional[str] = None):
        """
        Guarda el historial de chat de una conversación específica para un usuario.
        Puede opcionalmente guardar o actualizar el título de la conversación.
        """
        update_fields = {"messages": history, "last_updated": datetime.now()}
        if conversation_title:
            update_fields["title"] = conversation_title # Add or update title
        
        self.collection.update_one(
            {"user_id": user_id, "conversation_id": conversation_id},
            {"$set": update_fields},
            upsert=True
        )

    def save_backup(self, user_id: str, history_chunk: list):
        """Guarda una copia de seguridad de un chunk del historial de chat."""
        # This backup mechanism needs to be re-evaluated for conversations
        # For now, it just appends the chunk to a general backup history for the user
        self.collection_backup.update_one(
            {"user_id": user_id},
            {"$push": {"history": {"$each": history_chunk}}},
            upsert=True
        )

    def clear_conversation_history(self, user_id: str, conversation_id: str):
        """Borra el historial de chat de una conversación específica SIN eliminar el documento de la conversación."""
        self.collection.update_one(
            {"user_id": user_id, "conversation_id": conversation_id},
            {"$set": {"messages": []}}
        )

    def delete_conversation(self, user_id: str, conversation_id: str):
        """Elimina una conversación completa de la base de datos."""
        self.collection.delete_one({"user_id": user_id, "conversation_id": conversation_id})



    def make_metadata(self, response: GenerateResponse, duration: float, references) -> CallMetadata:
        """Crea los metadatos para una respuesta del modelo."""
        input_tokens = response.prompt_eval_count
        output_tokens = response.eval_count
        return call_metadata(
            provider="ollama",
            model=self.model,
            operation="generate",
            duration=duration,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            references=references,
            # Añade el nuevo campo 'disable' a los metadatos, por defecto en False
            disable=False
        )

    def answer(self, question: Question, chunks: Chunks, user_id: str, conversation_id: str) -> Tuple[Generator[str, None, None], str, Dict[str, Any]]: # Updated return type hint
        """Genera una respuesta a una pregunta del usuario."""
        user_msg = self.answer_user(question, chunks)
        system = self.answer_system()

        history: list = self.load_history(user_id, conversation_id)
        window = history[-self.memory_window_size:]

        if window:
            past = "\n".join([f"{m['role']}: {m['content']}" for m in window])
            prompt = past + "\nuser: " + user_msg
        else:
            prompt = user_msg

        response_tokens = [] # To accumulate tokens for final response
        bot_message_id = str(ObjectId()) # Generate ID early
        final_metadata = {} # To store final metadata

        def token_generator_func(): # Define a nested generator function
            nonlocal response_tokens, final_metadata # Allow modification of outer scope variables
            try:
                start_time = time.perf_counter()
                for chunk in api.generate(
                    model=self.model,
                    system=system,
                    options={"temperature": 0},
                    prompt=prompt,
                    stream=True
                ):
                    if hasattr(chunk, "response"):
                        token = chunk.response
                        response_tokens.append(token) # Accumulate tokens
                        yield token
                end_time = time.perf_counter()

                duration = end_time - start_time
                # Use the last chunk for metadata, as it contains final counts
                final_metadata = self.make_metadata(chunk, duration, chunks).model_dump()

                # Store both user and bot messages in history
                history.append({"role": "user", "content": question, "id": str(ObjectId())}) # Add ID to user messages
                history.append({"role": "assistant", "content": "".join(response_tokens), "metadata": final_metadata, "id": bot_message_id})

                self.save_history(user_id, conversation_id, history)
                self.save_backup(user_id, [history[-2], history[-1]]) # Re-evaluate backup strategy

            except Exception as e:
                raise LLMError("ollama assistant", e)

        return token_generator_func(), bot_message_id, final_metadata

    def update_message_metadata(self, user_id: str, message_id: str, new_metadata: Dict[str, Any]) -> bool:
        """
        Actualiza los metadatos de un mensaje específico en el historial de un usuario,
        buscando a través de todas las conversaciones.
        """
        # Find the conversation that contains the message
        conversation = self.collection.find_one(
            {"user_id": user_id, "messages.id": message_id}
        )
        
        if not conversation:
            return False # Message not found

        updated = False
        for i, message in enumerate(conversation["messages"]):
            if message.get("role") == "assistant" and message.get("id") == message_id:
                current_metadata = message.get("metadata", {})
                current_metadata.update(new_metadata)
                conversation["messages"][i]["metadata"] = current_metadata
                updated = True
                break
        
        if updated:
            self.save_history(user_id, conversation["conversation_id"], conversation["messages"])
        return updated

    def get_liked_solutions(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Recupera todos los mensajes del bot del historial de UN USUARIO a través de TODAS LAS CONVERSACIONES
        que están marcados como 'liked' (disable: True).
        También devuelve la pregunta de usuario precedente.
        """
        liked_solutions = []
        # Iterar sobre todas las conversaciones del usuario
        conversations = self.collection.find({"user_id": user_id}).sort("last_updated", -1)

        for conversation in conversations:
            history = conversation.get("messages", [])
            for i, message in enumerate(history):
                if message.get("role") == "assistant" and message.get("metadata", {}).get("disable") is True:
                    # Encuentra la pregunta de usuario precedente en la misma conversación
                    user_question = None
                    for j in range(i - 1, -1, -1):
                        if history[j].get("role") == "user":
                            user_question = history[j].get("content")
                            break
                    liked_solutions.append({
                        "question": user_question,
                        "answer": message.get("content"),
                        "metadata": message.get("metadata"),
                        "id": message.get("id"),
                        "conversation_id": conversation.get("conversation_id") # Add conversation_id
                    })
        return liked_solutions

    def get_user_conversations(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Obtiene una lista de todas las conversaciones de un usuario,
        incluyendo el conversation_id y un título (ej. las primeras palabras de la primera pregunta).
        Prioriza el título guardado explícitamente.
        """
        conversations_data = []
        conversations_cursor = self.collection.find(
            {"user_id": user_id},
            {"conversation_id": 1, "messages": {"$slice": 1}, "last_updated": 1, "title": 1} # Get only the first message and the title
        ).sort("last_updated", -1) # Sort by last updated, newest first

        for conv in conversations_cursor:
            conversation_id = conv.get("conversation_id")
            # Prioritize the explicitly stored title
            title = conv.get("title")
            if not title: # If no explicit title, fall back to first user message
                if conv.get("messages") and len(conv["messages"]) > 0:
                    first_message = conv["messages"][0]
                    if first_message.get("role") == "user" and first_message.get("content"):
                        # Use the first 5 words of the first user message as title
                        title = " ".join(first_message["content"].split()[:5]) + "..." if len(first_message["content"].split()) > 5 else first_message["content"]
                else:
                    title = "Nueva Conversación" # Default if no title and no messages

            conversations_data.append({
                "conversation_id": conversation_id,
                "title": title,
                "last_updated": conv.get("last_updated")
            })
        return conversations_data

    def has_liked_solution_in_conversation(self, conversation_id: str) -> bool:
        """
        Checks if a given conversation_id contains any bot messages marked as 'liked' (disable: True).
        """
        doc = self.collection.find_one(
            {"conversation_id": conversation_id, "messages.metadata.disable": True},
            {"messages": {"$elemMatch": {"metadata.disable": True, "role": "assistant"}}} # Project only the first matching message
        )
        # Check if a document was found and if any message within it has disable: True
        if doc and "messages" in doc and len(doc["messages"]) > 0:
            for message in doc["messages"]:
                if message.get("role") == "assistant" and message.get("metadata", {}).get("disable") is True:
                    return True
        return False
