import os
import shutil
from cenacellm.rag import RAG
from pydantic import BaseModel
from typing import AsyncGenerator, List
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from cenacellm.config import VECTORS_DIR, DOCUMENTS_DIR
from fastapi import FastAPI, UploadFile, File, HTTPException



rag = RAG(vectorstore_path=VECTORS_DIR)

class QueryRequest(BaseModel):
    user_id: str
    query: str
    k : int = 10
    filter_metadata: dict = None

def get_chat_history(user_id: str) -> str:
    histories = rag.get_user_history(user_id)
    if not histories:
        return []
    
    formatted_history = []
    for message in histories:
        role = "user" if message.get('role') == "user" else "bot"
        content = message.get('content', '')
        formatted_history.append({
            "role": role,  
            "content": content
        })

    return formatted_history

async def chat_stream(request: QueryRequest) -> AsyncGenerator[str, None]:
    user_id = request.user_id
    question = request.query
    k = request.k
    filter_metadata = request.filter_metadata if request.filter_metadata == "None" else None

    for token in rag.answer(
        user_id=user_id,
        question=question,
        k=k,
        filter_metadata=filter_metadata
    ):
        yield token

async def async_chat_stream(request: QueryRequest) -> StreamingResponse:
    return StreamingResponse(
        chat_stream(request),
        media_type="text/event-stream"
    )

def metadata_generator():
    return rag.last_chunks

def clear_user_history(user_id: str) -> None:
    rag.clear_user_history(user_id)

def load_documents(collection_name : str, force_reload : bool = False) -> list:
    lista = rag.load_documents(
        collection_name=collection_name,
        folder_path=DOCUMENTS_DIR,
        force_reload=force_reload
    )
    return lista

def get_preprocessed_files() -> dict:
    return rag.processed_files

async def upload_documents(files: List[UploadFile] = File(...)):
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
    for file_name in files_name:
        file_path = os.path.join(DOCUMENTS_DIR, file_name)
        if os.path.exists(file_path):
            os.remove(file_path)
    rag._delete_processed_file(files_name)

async def view_document(filename: str):
    # Asegúrate de que esta 'base_directory' apunte a la carpeta donde se guardan tus PDFs
    # Es crucial que esta ruta sea accesible por tu servidor FastAPI
    base_directory = DOCUMENTS_DIR # Ajusta esta ruta según tu configuración
    file_path = os.path.join(base_directory, filename)

    if os.path.exists(file_path):
        # Retorna el archivo con Content-Disposition: inline para que el navegador lo muestre
        return FileResponse(file_path, media_type="application/pdf", headers={"Content-Disposition": "inline"})
    else:
        raise HTTPException(status_code=404, detail="Documento no encontrado en el servidor.")




    

