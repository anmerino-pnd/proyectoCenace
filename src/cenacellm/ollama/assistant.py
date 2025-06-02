import os
import json
import time
from typing import Generator, Dict, Any, List, Tuple # Importa List y Tuple
from pymongo import MongoClient
from bson.objectid import ObjectId # Importa ObjectId
from ollama import GenerateResponse
from cenacellm.clients import ollama as api, mongo_uri, db_name

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
        self.model = "phi4:latest"
        self.memory_window_size = 3

        self.mongo_uri = mongo_uri
        self.db_name = db_name
        self.collection_name = "user_histories"
        self.collection_backup_name = "user_histories_backup"

        self.client = MongoClient(self.mongo_uri)
        self.db = self.client[self.db_name]
        self.collection = self.db[self.collection_name]
        self.collection_backup = self.db[self.collection_backup_name]


    def load_history(self, user_id: str) -> list:
        """Carga el historial de chat de un usuario."""
        doc = self.collection.find_one({"user_id": user_id})
        return doc["history"] if doc else []

    def save_history(self, user_id: str, history: list):
        """Guarda el historial de chat de un usuario."""
        self.collection.update_one(
            {"user_id": user_id},
            {"$set": {"history": history}},
            upsert=True
        )

    def save_backup(self, user_id: str, history: list):
        """Guarda una copia de seguridad del historial de chat."""
        self.collection_backup.update_one(
            {"user_id": user_id},
            {"$set": {"history": history}},
            upsert=True
        )

    def clear_user_history(self, user_id: str):
        """Borra el historial de chat de un usuario SIN eliminar el documento ni cambiar el _id."""
        self.collection.update_one(
            {"user_id": user_id},
            {"$set": {"history": []}}
        )


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

    def answer(self, question: Question, chunks: Chunks, user_id: str) -> Tuple[Generator[str, None, None], str, Dict[str, Any]]: # Updated return type hint
        """Genera una respuesta a una pregunta del usuario."""
        user_msg = self.answer_user(question, chunks)
        system = self.answer_system()

        history: list = self.load_history(user_id)
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
                history.append({"role": "user", "content": question})
                history.append({"role": "assistant", "content": "".join(response_tokens), "metadata": final_metadata, "id": bot_message_id})

                self.save_history(user_id, history)
                self.save_backup(user_id, history)

            except Exception as e:
                raise LLMError("ollama assistant", e)

        return token_generator_func(), bot_message_id, final_metadata

    def update_message_metadata(self, user_id: str, message_id: str, new_metadata: Dict[str, Any]) -> bool:
        """
        Actualiza los metadatos de un mensaje específico en el historial de un usuario.
        """
        history = self.load_history(user_id)
        updated = False
        for i, message in enumerate(history):
            # Asegúrate de que el mensaje sea del bot y tenga el ID correcto
            if message.get("role") == "assistant" and message.get("id") == message_id:
                # Actualiza los metadatos existentes o añade nuevos campos
                current_metadata = message.get("metadata", {})
                current_metadata.update(new_metadata)
                history[i]["metadata"] = current_metadata
                updated = True
                break
        if updated:
            self.save_history(user_id, history)
        return updated

    def get_liked_solutions(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Recupera todos los mensajes del bot del historial de un usuario que están marcados como 'liked' (disable: True).
        También devuelve la pregunta de usuario precedente.
        """
        history = self.load_history(user_id)
        liked_solutions = []
        for i, message in enumerate(history):
            if message.get("role") == "assistant" and message.get("metadata", {}).get("disable") is True:
                # Encuentra la pregunta de usuario precedente
                user_question = None
                # Busca hacia atrás para encontrar el mensaje de usuario anterior
                for j in range(i - 1, -1, -1):
                    if history[j].get("role") == "user":
                        user_question = history[j].get("content")
                        break
                liked_solutions.append({
                    "question": user_question,
                    "answer": message.get("content"),
                    "metadata": message.get("metadata"),
                    "id": message.get("id") # Incluye el ID del mensaje para un posible uso futuro (ej. quitar "me gusta")
                })
        return liked_solutions
