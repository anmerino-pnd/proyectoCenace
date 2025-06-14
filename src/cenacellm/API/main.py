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
    DeleteSolutionsRequest, # Import the new model for deleting solutions
    DeleteDocumentsRequest, # NUEVO: Importa el modelo para eliminar documentos
    get_chat_history,
    get_preprocessed_files,
    upload_documents,
    delete_document, # Esta función ahora espera DeleteDocumentsRequest
    view_document,
    update_message_metadata, # Importa la nueva función
    get_liked_solutions, # Importa la nueva función
    process_liked_solutions_to_vectorstore, # Importa la nueva función
    delete_solution_by_reference # Import the new deletion function
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

# MODIFICADO: Ahora espera el modelo DeleteDocumentsRequest
@app.post("/delete_document")
def delete_doc(request: DeleteDocumentsRequest):
    """Endpoint para eliminar documentos del servidor."""
    return delete_document(request)

@app.get("/view_document/{filename}")
async def view_doc(filename: str):
    """Endpoint para ver documentos PDF en el navegador."""
    return await view_document(filename)

@app.patch("/history/{user_id}/messages/{message_id}")
async def patch_message_metadata(user_id: str, message_id: str, request: UpdateMetadataRequest):
    """
    Endpoint para actualizar los metadatos de un mensaje específico en el historial del usuario.
    Se utiliza para marcar/desmarcar un mensaje como 'liked'.
    """
    return update_message_metadata(user_id, message_id, request.new_metadata)

@app.get("/solutions/{user_id}")
async def solutions(user_id: str):
    """
    Endpoint para obtener una lista de soluciones (mensajes del bot) que han sido marcadas como 'liked'.
    """
    return get_liked_solutions(user_id)

@app.post("/process_liked_solutions/{user_id}")
async def process_liked_solutions(user_id: str):
    """
    Endpoint para procesar las soluciones "likeadas" de un usuario y añadirlas al vectorstore.
    """
    return process_liked_solutions_to_vectorstore(user_id)

@app.post("/delete_solution")
def delete_solution(request: DeleteSolutionsRequest): # New endpoint for deleting solutions
    """
    Endpoint para eliminar soluciones del vectorstore basado en sus reference_ids.
    """
    return delete_solution_by_reference(request.reference_ids)
