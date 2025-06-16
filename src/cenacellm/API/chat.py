import os
import shutil
from cenacellm.rag import RAG
from pydantic import BaseModel
from typing import AsyncGenerator, List, Dict, Any, Union
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from cenacellm.config import VECTORS_DIR, DOCUMENTS_DIR
from fastapi import FastAPI, UploadFile, File, HTTPException, Body # Importa Body
import json # Importa json para serializar el diccionario final
from bson.objectid import ObjectId # Import ObjectId for new conversation IDs

rag = RAG(vectorstore_path=VECTORS_DIR)

class QueryRequest(BaseModel):
    user_id: str
    conversation_id: str # Added conversation_id
    query: str
    k : int = 10
    filter_metadata: dict = None

# Nuevo modelo Pydantic para actualizar los metadatos de un mensaje
class UpdateMetadataRequest(BaseModel):
    new_metadata: Dict[str, Any]

class DeleteSolutionsRequest(BaseModel): # New Pydantic model for deleting solutions
    reference_ids: List[str]

# NUEVO: Modelo Pydantic para eliminar documentos por reference_id
class DeleteDocumentsRequest(BaseModel):
    reference_ids: List[str]

# NUEVO: Modelo Pydantic para eliminar una conversación
class DeleteConversationRequest(BaseModel):
    user_id: str
    conversation_id: str


def get_chat_history(user_id: str, conversation_id: str) -> str: # Added conversation_id
    """Obtiene el historial de chat formateado para un usuario y conversación específica."""
    histories = rag.get_user_history(user_id, conversation_id) # Pass conversation_id
    if not histories:
        return []

    formatted_history = []
    for message in histories:
        role = "user" if message.get('role') == "user" else "bot"
        content = message.get('content', '')
        if role == "bot":
            formatted_history.append({
                "role": role,
                "content": content,
                "id": message.get("id"),
                "metadata": message.get("metadata", {})
            })
        else:
            formatted_history.append({
                "role": role,
                "content": content,
                "id": message.get("id", str(ObjectId())) # Ensure user messages also have an ID
            })

    return formatted_history

async def chat_stream(request: QueryRequest) -> AsyncGenerator[str, None]:
    """Generates a stream of chat response tokens."""
    user_id = request.user_id
    conversation_id = request.conversation_id # Get conversation_id
    question = request.query
    k = request.k
    filter_metadata = request.filter_metadata if request.filter_metadata != "None" else None


    for item in rag.answer(
        user_id=user_id,
        conversation_id=conversation_id, # Pass conversation_id
        question=question,
        k=k,
        filter_metadata=filter_metadata
    ):
        # El rag.answer ya se encarga de json.dumps si es un diccionario
        yield item

async def async_chat_stream(request: QueryRequest) -> StreamingResponse:
    """Envuelve el stream de chat en una StreamingResponse."""
    return StreamingResponse(
        chat_stream(request),
        media_type="text/event-stream"
    )

def metadata_generator():
    """Retorna los últimos chunks de metadatos procesados por RAG."""
    # Nota: rag.last_chunks contiene objetos Text, no diccionarios.
    # Necesitas convertirlos a diccionarios si este endpoint espera JSON.
    # Asumiendo que este endpoint es para depuración y quieres ver la estructura Text.
    return [chunk.model_dump() for chunk in rag.last_chunks] if hasattr(rag, 'last_chunks') else []

def clear_user_history(user_id: str, conversation_id: str) -> None: # Added conversation_id
    """Borra el historial de chat de una conversación específica para un usuario."""
    rag.clear_user_history(user_id, conversation_id) # Pass conversation_id

def load_documents(collection_name : str, force_reload : bool = False) -> list:
    """Carga documentos en el sistema RAG."""
    # rag.load_documents ya llama a refresh_processed_data()
    lista = rag.load_documents(
        collection_name=collection_name,
        folder_path=DOCUMENTS_DIR,
        force_reload=force_reload
    )
    return lista

def get_preprocessed_files() -> dict:
    """Obtiene la lista de archivos preprocesados."""
    # Asegurarse de que la caché está fresca antes de devolverla
    rag.refresh_processed_data() 
    return rag.processed_files

async def upload_documents(files: List[UploadFile] = File(...)):
    """Sube documentos PDF al servidor."""
    responses = []

    for file in files:
        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail=f"El archivo '{file.filename}' no es un PDF.")

        file_location = os.path.join(DOCUMENTS_DIR, file.filename)

        try:
            with open(file_location, "wb+") as file_object:
                shutil.copyfileobj(file.file, file_object)
            responses.append({"filename": file.filename, "message": "Archivo subido con éxito"})
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al guardar '{file.filename}': {e}")
    
    # Después de subir documentos, puedes considerar recargar la lista de procesados
    # para asegurar que los recién subidos se reflejen si no se procesan inmediatamente.
    # Si 'load_documents' se llama después de subir, no es estrictamente necesario aquí.
    rag.refresh_processed_data() # Opcional, si no hay un paso de "procesar" explícito.

    return JSONResponse(content={"files": responses})

# MODIFICADO: Ahora acepta DeleteDocumentsRequest
def delete_document(request: DeleteDocumentsRequest):
    """Elimina documentos del vectorstore y del registro de archivos procesados
       basado en sus reference_ids.
    """
    successful_deletions = []
    failed_deletions = []
    for reference_id in request.reference_ids:
        try:
            # Primero, obtenemos el file_key asociado a este reference_id para poder eliminarlo de rag.processed_files
            # Esto asume que 'reference' es único y está en processed_files.
            file_key_to_delete = None
            for key, doc_info in rag.processed_files.items():
                if doc_info.get("reference") == reference_id:
                    file_key_to_delete = key
                    break

            if file_key_to_delete:
                rag.delete_from_vectorstore(reference_id) # Eliminar del vectorstore
                # Eliminar del registro de archivos procesados en la DB y de la caché en memoria
                rag.processed_files_collection.delete_one({"reference": reference_id})
                # No llamamos a _delete_processed_file directamente porque ya actualizamos la caché via refresh
                # y no siempre tenemos el file_key fácilmente. La clave es el refresh.
                
                # Opcional: Si quieres eliminar también el archivo físico, añade la lógica aquí
                # filepath = os.path.join(DOCUMENTS_DIR, file_key_to_delete)
                # if os.path.exists(filepath):
                #     os.remove(filepath)

                successful_deletions.append(reference_id)
            else:
                failed_deletions.append(f"Documento con reference_id {reference_id} no encontrado en registros.")

        except Exception as e:
            print(f"Error al eliminar el documento con reference_id {reference_id}: {e}")
            failed_deletions.append(f"Error al eliminar el documento con ID {reference_id}: {e}")
    
    # Después de todas las eliminaciones, refrescar la caché en memoria
    rag.refresh_processed_data()

    if failed_deletions:
        raise HTTPException(status_code=500, detail={"success": successful_deletions, "failed": failed_deletions})
    return {"status": "success", "message": f"Se eliminaron {len(successful_deletions)} documentos.", "deleted_ids": successful_deletions}


async def view_document(filename: str):
    """Permite ver un documento PDF en el navegador."""
    base_directory = DOCUMENTS_DIR
    file_path = os.path.join(base_directory, filename)

    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="application/pdf", headers={"Content-Disposition": "inline"})
    else:
        raise HTTPException(status_code=404, detail="Documento no encontrado en el servidor.")

def update_message_metadata(user_id: str, message_id: str, new_metadata: Dict[str, Any]):
    """
    Actualiza los metadatos de un mensaje específico en el historial del usuario.
    """
    updated = rag.assistant.update_message_metadata(user_id, message_id, new_metadata)
    if not updated:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado o no es un mensaje del bot.")
    return {"status": "success", "message": "Metadatos del mensaje actualizados."}

def get_liked_solutions(user_id: str) -> List[Dict[str, Any]]:
    """
    Obtiene una lista de soluciones (mensajes del bot) que han sido marcadas como 'liked'.
    """
    return rag.assistant.get_liked_solutions(user_id)

def process_liked_solutions_to_vectorstore(user_id: str) -> Dict[str, Any]:
    """
    Procesa las soluciones "likeadas" de un usuario y las añade al vectorstore.
    Retorna el número de soluciones nuevas añadidas.
    """
    # rag.add_liked_solutions_to_vectorstore ya llama a refresh_processed_data()
    solutions_added_count = rag.add_liked_solutions_to_vectorstore(user_id)
    return {"status": "success", "message": f"Se han procesado {solutions_added_count} nuevas soluciones 'likeadas'.", "count": solutions_added_count}

def delete_solution_by_reference(reference_ids: List[str]):
    """
    Elimina soluciones del vectorstore y del registro de archivos procesados
    basado en sus reference_ids, y desmarca el 'like' del mensaje original.
    """
    successful_deletions = []
    failed_deletions = []
    for ref_id in reference_ids:
        try:
            # 1. Obtener el user_id asociado a esta solución para poder actualizar el historial
            # La referencia (ref_id) en processed_files_collection para soluciones es el message_id.
            solution_info = rag.processed_files_collection.find_one(
                {"reference": ref_id, "collection": "soluciones"}
            )
            print(solution_info)
            if solution_info and "user_id" in solution_info:
                user_id_of_solution = solution_info["user_id"]
                
                # 2. Desmarcar el 'like' del mensaje original en el historial del chat
                # Llamamos directamente a update_message_metadata del assistant, pasando el user_id
                rag.assistant.update_message_metadata(user_id_of_solution, ref_id, {"disable": False})

            # 3. Eliminar del vectorstore
            rag.delete_from_vectorstore(ref_id)
            
            # 4. Eliminar del registro de soluciones procesadas en la DB
            rag.processed_files_collection.delete_one({"reference": ref_id, "collection": "soluciones"})
            
            successful_deletions.append(ref_id)
        except Exception as e:
            print(f"Error al eliminar la solución con reference_id {ref_id}: {e}")
            failed_deletions.append(f"Error al eliminar la solución con ID {ref_id}: {e}")
    
    # Después de todas las eliminaciones, refrescar la caché en memoria del RAG
    rag.refresh_processed_data()

    if failed_deletions:
        raise HTTPException(status_code=500, detail={"success": successful_deletions, "failed": failed_deletions})
    return {"status": "success", "message": f"Se eliminaron {len(successful_deletions)} soluciones.", "deleted_ids": successful_deletions}

def get_user_conversations(user_id: str) -> List[Dict[str, Any]]: # New function
    """Obtiene una lista de las conversaciones de un usuario."""
    return rag.get_user_conversations(user_id)

def create_new_conversation(user_id: str) -> Dict[str, str]: # New function
    """Crea una nueva conversación y devuelve su ID."""
    new_conversation_id = str(ObjectId())
    # Save an empty conversation to create the document in MongoDB
    rag.assistant.save_history(user_id, new_conversation_id, [])
    return {"conversation_id": new_conversation_id}

def delete_conversation(user_id: str, conversation_id: str): # New function
    """Elimina una conversación específica para un usuario."""
    rag.assistant.delete_conversation(user_id, conversation_id)
    return {"status": "success", "message": f"Conversación {conversation_id} eliminada."}

