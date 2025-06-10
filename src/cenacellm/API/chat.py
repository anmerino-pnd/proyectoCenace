import os
import shutil
from cenacellm.rag import RAG
from pydantic import BaseModel
from typing import AsyncGenerator, List, Dict, Any, Union
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from cenacellm.config import VECTORS_DIR, DOCUMENTS_DIR
from fastapi import FastAPI, UploadFile, File, HTTPException, Body # Importa Body
import json # Importa json para serializar el diccionario final

rag = RAG(vectorstore_path=VECTORS_DIR)

class QueryRequest(BaseModel):
    user_id: str
    query: str
    k : int = 10
    filter_metadata: dict = None

# Nuevo modelo Pydantic para actualizar los metadatos de un mensaje
class UpdateMetadataRequest(BaseModel):
    new_metadata: Dict[str, Any]

def get_chat_history(user_id: str) -> str:
    """Obtiene el historial de chat formateado para un usuario."""
    histories = rag.get_user_history(user_id)
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
                "content": content
            })

    return formatted_history

async def chat_stream(request: QueryRequest) -> AsyncGenerator[str, None]:
    """Genera un stream de tokens de respuesta del chat."""
    user_id = request.user_id
    question = request.query
    k = request.k
    filter_metadata = request.filter_metadata if request.filter_metadata == "None" else None

    for item in rag.answer(
        user_id=user_id,
        question=question,
        k=k,
        filter_metadata=filter_metadata
    ):
        if isinstance(item, dict):
            yield json.dumps(item) 
        else:
            yield item

async def async_chat_stream(request: QueryRequest) -> StreamingResponse:
    """Envuelve el stream de chat en una StreamingResponse."""
    return StreamingResponse(
        chat_stream(request),
        media_type="text/event-stream"
    )

def metadata_generator():
    """Retorna los últimos chunks de metadatos procesados por RAG."""
    return rag.last_chunks

def clear_user_history(user_id: str) -> None:
    """Borra el historial de chat de un usuario."""
    rag.clear_user_history(user_id)

def load_documents(collection_name : str, force_reload : bool = False) -> list:
    """Carga documentos en el sistema RAG."""
    lista = rag.load_documents(
        collection_name=collection_name,
        folder_path=DOCUMENTS_DIR,
        force_reload=force_reload
    )
    return lista

def get_preprocessed_files() -> dict:
    """Obtiene la lista de archivos preprocesados."""
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

    return JSONResponse(content={"files": responses})

def delete_document(files_name: List[str]):
    """Elimina documentos del servidor y del registro de archivos procesados."""
    for file_name in files_name:
        file_path = os.path.join(DOCUMENTS_DIR, file_name)

        rag.delete_from_vectorstore(file_name)

        if os.path.exists(file_path):
            os.remove(file_path)
    

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
    solutions_added_count = rag.add_liked_solutions_to_vectorstore(user_id)
    return {"status": "success", "message": f"Se han procesado {solutions_added_count} nuevas soluciones 'likeadas'.", "count": solutions_added_count}

