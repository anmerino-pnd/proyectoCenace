import os
import json
import time
import pymongo
from pymongo import MongoClient
from bson.objectid import ObjectId
from ollama import GenerateResponse
from datetime import datetime, timezone
from typing import Generator, Dict, Any, List, Tuple, Optional

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

        self.LLM_CONTEXT_WINDOW = 30

        self.client = MongoClient(self.mongo_uri)
        self.db = self.client[self.db_name]
        self.conversations = self.db["conversations"] # Aquí se almacenan las conversaciones 
        self.messages = self.db["messages"] # Cada documento es un par de Pregunta-Respuesta

        # Create indexes for efficient querying
        self.messages.create_index([
            ("user_id", pymongo.ASCENDING), 
            ("conversation_id", pymongo.ASCENDING), 
            ("timestamp", pymongo.ASCENDING)
        ])

        self.conversations.create_index([
            ("user_id", pymongo.ASCENDING),
            ("last_updated", pymongo.DESCENDING)
        ])

    def _add_message(self, 
                     conversation_id: str, 
                     bot_message_id, 
                     user_id: str, 
                     question: str, 
                     full_answer: str,
                     metadata: Dict = None) -> str:
        """
        Método interno para guardar un mensaje único y actualizar la conversación padre.
        Retorna el ID del mensaje insertado (string).
        """
        message_doc = {
            "conversation_id": conversation_id,
            "bot_message_id": bot_message_id,
            "user_id": user_id,
            "question": question,
            "full_answer": full_answer,
            "metadata": metadata or {},
            "timestamp": metadata.get("timestamp") if metadata else datetime.now(timezone.utc).isoformat()
        }
        
        result = self.messages.insert_one(message_doc)
        
        self.conversations.update_one(
            {"conversation_id": conversation_id, "user_id": user_id},
            {"$set": {"last_updated": datetime.now(timezone.utc)}}
        )
        
        return str(result.inserted_id)
    
    def _conversation_history(self,
                                conversation_id,
                                user_id,
                                role,
                                content):
            if content:
                short_msg = {
            "role": role,
            "content": content,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
                self.conversations.update_one(
                    {"conversation_id": conversation_id,
                    "user_id": user_id},
                    {
                        "$push":{
                            "history": {
                                "$each": [short_msg],
                                "$sort": {"timestamp": 1},
                                "$slice": -self.LLM_CONTEXT_WINDOW  
                            }
                        },
                        "$set": {"last_updated": datetime.now(timezone.utc)}
                    }
                )
            else:
                self.conversations.update_one(
                    {"conversation_id": conversation_id,
                    "user_id": user_id},
                    {"$set": {"last_updated": datetime.now(timezone.utc)}}
                )

    def create_conversation(self, user_id: str, conversation_id: str, title: str = None, ticket_context: Dict[str, str] = None) -> Dict[str, Any]:
        """
        Crea una nueva conversación en la base de datos.
        Si se proporciona 'ticket_context', inserta un mensaje inicial automático.
        """
        # MODIFICACIÓN CLAVE: Si title es None, guardamos None en la DB.
        # Esto permite que get_user_conversations genere un título dinámico basado en el historial después.
        new_conversation = {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "title": title, # Antes: title or "Nueva Conversación". Ahora dejamos que sea None si no hay título.
            "history": [],
            "created_at": datetime.now(timezone.utc),
            "last_updated": datetime.now(timezone.utc)
        }
        
        # Usar upsert para evitar duplicados
        self.conversations.update_one(
            {"conversation_id": conversation_id, "user_id": user_id},
            {"$setOnInsert": new_conversation},
            upsert=True
        )

        # Si hay contexto de ticket, inyectamos el primer "mensaje" automáticamente
        if ticket_context:
            ticket_title = ticket_context.get("title", "Sin título")
            ticket_desc = ticket_context.get("description", "Sin descripción")
            
            # Formateamos bonito el mensaje del usuario (contexto)
            formatted_question = (
                f"**Contexto del Ticket**\n\n"
                f"**Título:** {ticket_title}\n"
                f"**Descripción:** {ticket_desc}\n\n"
                f"Por favor, analiza este problema y ayúdame a solucionarlo."
            )

            # Respuesta automática del sistema para confirmar recepción
            initial_answer = (
                f"Entendido. He recibido la información del ticket **{ticket_title}**.\n"
                "Estoy analizando el contexto. ¿En qué puedo ayudarte específicamente con este problema?"
            )
            
            # ID ficticio para este mensaje inicial
            initial_bot_id = str(ObjectId())

            # 1. Guardar en la colección de mensajes (History visual persistente)
            self._add_message(
                conversation_id=conversation_id,
                bot_message_id=initial_bot_id,
                user_id=user_id,
                question=formatted_question,
                full_answer=initial_answer,
                metadata={"disable": False, "source": "ticket_initialization"}
            )

            # 2. Guardar en la memoria a corto plazo del LLM (conversations.history)
            self._conversation_history(conversation_id, user_id, "human", formatted_question)
            self._conversation_history(conversation_id, user_id, "assistant", initial_answer)
        
        return new_conversation

    def load_history(self, user_id: str, conversation_id: str) -> List[Dict]:
        """
        Recupera TODO el historial para mostrarlo en el Frontend.
        Transforma la estructura de pares (pregunta-respuesta) de la DB
        a una lista plana de mensajes {role, content} que el JS puede renderizar.
        """
        cursor = self.messages.find(
            {"user_id": user_id, "conversation_id": conversation_id}
        ).sort("timestamp", pymongo.ASCENDING)
        
        history = []
        for doc in cursor:
            # Normalizar timestamp
            timestamp = doc.get('timestamp')
            if isinstance(timestamp, datetime):
                timestamp = timestamp.isoformat()

            # 1. Procesar el mensaje del usuario
            # Usamos "user" en lugar de "human" para que app.js lo pinte a la derecha
            if "question" in doc and doc["question"]:
                history.append({
                    "role": "user", 
                    "content": doc["question"],
                    "timestamp": timestamp
                })
            
            # 2. Procesar la respuesta del asistente
            if "full_answer" in doc and doc["full_answer"]:
                # Es vital pasar el 'id' correcto para que funcionen los likes/referencias
                bot_msg_id = doc.get("bot_message_id", str(doc['_id']))
                
                history.append({
                    "role": "assistant",
                    "content": doc["full_answer"],
                    "id": bot_msg_id,
                    "metadata": doc.get("metadata", {}),
                    "timestamp": timestamp
                })
            
        return history

    def _get_llm_context(self, user_id: str, conversation_id: str) -> List[Dict]:
        """
        Recupera solo los últimos N mensajes para dárselos al LLM.
        Esto es lo que hace el sistema eficiente.
        """
        # Obtenemos los últimos N (orden descendente por tiempo para obtener los recientes)
        conversation = self.conversations.find_one(
            {"user_id": user_id, "conversation_id": conversation_id},
            {"history": 1, "_id": 0}
        )
        
        if conversation and "history" in conversation:
            return conversation["history"][-self.LLM_CONTEXT_WINDOW:]
        
        return []

    def clear_conversation_history(self, user_id: str, conversation_id: str):
        """Borra el historial de chat de una conversación específica SIN eliminar el documento de la conversación."""
        self.conversations.update_one(
            {"user_id": user_id, "conversation_id": conversation_id},
            {"$set": {"history": [], "last_updated": datetime.now(timezone.utc)}}
        )

    def delete_conversation(self, user_id: str, conversation_id: str):
        self.conversations.delete_one({"user_id": user_id, "conversation_id": conversation_id})

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
            disable=False
        )

    def answer(self, question: Question, chunks: Chunks, user_id: str, conversation_id: str) -> Tuple[Generator[str, None, None], str, Dict[str, Any]]: # Updated return type hint
        """Genera una respuesta a una pregunta del usuario."""
        user_msg = self.answer_user(question, chunks)
        context_messages = self._get_llm_context(user_id, conversation_id)

        system = self.answer_system(context_messages)

        full_answer = ""
        bot_message_id = str(ObjectId()) # Generate ID early
        final_metadata = {} # To store final metadata

        def token_generator_func(): # Define a nested generator function
            nonlocal full_answer, final_metadata # Allow modification of outer scope variables
            try:
                start_time = time.perf_counter()
                last_chunk = None

                for chunk in api.generate(
                    model=self.model,
                    system=system,
                    options={"temperature": 0},
                    prompt=user_msg,
                    stream=True
                ):
                    if hasattr(chunk, "response"):
                        token = chunk.response
                        full_answer += token
                        yield token
                    last_chunk = chunk
                
                end_time = time.perf_counter()
                duration = end_time - start_time

                # CORRECCIÓN CRÍTICA:
                # Usamos last_chunk para asegurarnos de tener la última info del stream.
                # Usamos .update() para mutar el diccionario original que tiene rag.py
                if last_chunk:
                    metadata_values = self.make_metadata(last_chunk, duration, chunks).model_dump()
                    final_metadata.update(metadata_values) # <--- AQUÍ: Mutar, no reasignar.

                    print(f"DEBUG MONGO: Guardando mensaje {bot_message_id} con metadata keys: {list(final_metadata.keys())}")

                    if full_answer.strip():  
                        self._add_message(
                            conversation_id,
                            bot_message_id,
                            user_id,
                            question,
                            full_answer,
                            final_metadata
                        )
                        self._conversation_history(
                            conversation_id,
                            user_id,
                            role="human",
                            content=question
                        )
                        self._conversation_history(
                            conversation_id,
                            user_id,
                            role="assistant",
                            content=full_answer
                        )
                else:
                    print("DEBUG MONGO: No se recibieron chunks, no se guardó nada.")

            except Exception as e:
                print(f"DEBUG MONGO ERROR: {e}")
                raise LLMError("ollama assistant", e)

        return token_generator_func(), bot_message_id, final_metadata

    def update_message_metadata(self, user_id: str, message_id: str, new_metadata: Dict[str, Any]) -> bool:
        """
        Actualiza los metadatos de un mensaje específico en el historial de un usuario.
        CORREGIDO: Usa notación de puntos (metadata.field) para NO sobrescribir todo el objeto metadata.
        """
        # Transformamos {'disable': True} en {'metadata.disable': True}
        update_fields = {f"metadata.{key}": value for key, value in new_metadata.items()}
        
        if not update_fields:
            return False

        result = self.messages.update_one(
            {"user_id": user_id, "bot_message_id": message_id},
            {"$set": update_fields}  # Ahora usamos el diccionario con notación de puntos
        )
        
        return result.modified_count > 0

    def get_liked_solutions(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Recupera todos los mensajes del bot del historial de UN USUARIO a través de TODAS LAS CONVERSACIONES
        que están marcados como 'liked' (disable: True).
        También devuelve la pregunta de usuario precedente.
        """
        liked_solutions = []
        messages = self.messages.find(
            {"user_id": user_id, "metadata.disable": True}
        ).sort("timestamp", -1)

        for message in messages:
            liked_solutions.append({
                "question": message.get('question'),
                "answer": message.get('full_answer'),
                "metadata": message.get("metadata"),
                "id": message.get("bot_message_id"),
                "conversation_id": message.get("conversation_id") 
            })
        return liked_solutions

    def unmark_solution(self, message_id: str) -> bool:
        """
        NUEVA FUNCIÓN: Elimina el estado 'disable: True' (like) de un mensaje.
        Esto es crucial para que desaparezca de la lista de Soluciones después de borrarlo del VectorStore.
        """
        result = self.messages.update_one(
            {"bot_message_id": message_id},
            {"$set": {"metadata.disable": False}}
        )
        return result.modified_count > 0

    def get_user_conversations(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Obtiene una lista de todas las conversaciones de un usuario,
        incluyendo el conversation_id y un título (ej. las primeras palabras de la primera pregunta).
        Prioriza el título guardado explícitamente.
        """
        conversations_data = []
        conversations_cursor = self.conversations.find(
            {"user_id": user_id}
        ).sort("last_updated", -1)

        for conv in conversations_cursor:
            conversation_id = conv.get("conversation_id")
            title = conv.get("title")
            
            # Si NO hay título O el título es el genérico "Nueva Conversación", intentamos generar uno mejor
            if not title or title == "Nueva Conversación": 
                if conv.get("history") and len(conv["history"]) > 0:
                    first_message = conv["history"][0]
                    if first_message.get("role") == "human" and first_message.get("content"):
                        # Usar las primeras 5 palabras como título
                        # Limpiamos el texto de posibles prefijos como "**Contexto del Ticket**" si es muy largo
                        content = first_message["content"]
                        title = " ".join(content.split()[:5]) + "..."
                        
                        # Opcional: Actualizar el título en la base de datos para no recalcularlo siempre
                        # self.conversations.update_one({"_id": conv["_id"]}, {"$set": {"title": title}})
                else:
                    title = "Nueva Conversación"

            conversations_data.append({
                "conversation_id": conversation_id,
                "title": title,
                "last_updated": conv.get("last_updated").isoformat() if conv.get("last_updated") else None
            })
        return conversations_data