from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from typing import List, Dict, Any
from cenacellm.API.chat import (
    async_chat_stream,
    metadata_generator,
    clear_user_history,
    load_documents,
    QueryRequest,
    UpdateMetadataRequest, # Importa el nuevo modelo de solicitud
    get_chat_history,
    get_preprocessed_files,
    upload_documents,
    delete_document,
    view_document,
    update_message_metadata, # Importa la nueva función
    get_liked_solutions, # Importa la nueva función
    process_liked_solutions_to_vectorstore # Importa la nueva función
)
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/chat")
async def chat(request: QueryRequest):
    """Endpoint principal para el chat con el modelo."""
    return await async_chat_stream(request)

@app.get("/metadata")
async def metadata():
    """Endpoint para obtener metadatos de la última respuesta del chat."""
    return metadata_generator()

@app.get("/history/{user_id}")
async def history(user_id: str):
    """Endpoint para obtener el historial de chat de un usuario."""
    return get_chat_history(user_id)

@app.delete("/history/{user_id}")
async def delete_history(user_id: str):
    """Endpoint para borrar el historial de chat de un usuario."""
    clear_user_history(user_id)
    return {"status": "success", "message": "Historial de usuario borrado."}

@app.post("/load_documents")
async def load_docs(collection_name: str, force_reload: bool = False):
    """Endpoint para cargar documentos en el sistema RAG."""
    return load_documents(collection_name, force_reload)

@app.get("/documents")
async def documents():
    """Endpoint para obtener la lista de documentos preprocesados."""
    return get_preprocessed_files()

@app.post("/upload_documents")
async def upload_doc(files: List[UploadFile] = File(...)):
    """Endpoint para subir documentos PDF al servidor."""
    return await upload_documents(files)

@app.post("/delete_document")
def delete_doc(file_key: List[str]):
    """Endpoint para eliminar documentos del servidor."""
    return delete_document(file_key)

@app.get("/view_document/{filename}")
async def view_doc(filename: str):
    """Endpoint para ver documentos PDF en el navegador."""
    return await view_document(filename)

# Nuevo endpoint para actualizar los metadatos de un mensaje específico
@app.patch("/history/{user_id}/messages/{message_id}")
async def patch_message_metadata(user_id: str, message_id: str, request: UpdateMetadataRequest):
    """
    Endpoint para actualizar los metadatos de un mensaje específico en el historial del usuario.
    Se utiliza para marcar/desmarcar un mensaje como 'liked'.
    """
    return update_message_metadata(user_id, message_id, request.new_metadata)

# Nuevo endpoint para obtener soluciones "likeadas"
@app.get("/solutions/{user_id}")
async def solutions(user_id: str):
    """
    Endpoint para obtener una lista de soluciones (mensajes del bot) que han sido marcadas como 'liked'.
    """
    return get_liked_solutions(user_id)

# Nuevo endpoint para procesar soluciones "likeadas" al vectorstore
@app.post("/process_liked_solutions/{user_id}")
async def process_liked_solutions(user_id: str):
    """
    Endpoint para procesar las soluciones "likeadas" de un usuario y añadirlas al vectorstore.
    """
    return process_liked_solutions_to_vectorstore(user_id)

