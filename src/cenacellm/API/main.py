from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse # Importa FileResponse
from typing import List
from cenacellm.API.chat import (
    async_chat_stream,
    metadata_generator,
    clear_user_history,
    load_documents,
    QueryRequest,
    get_chat_history,
    get_preprocessed_files,
    upload_documents,
    delete_document
)
import os # Importa os para manejar rutas de archivos

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/ping")
async def ping():
    return {"status": "ok", "message": "API FastAPI funcionando"}

@app.post("/echo")
async def echo():
    return {"status": "ok", "message": "Received POST request"}

@app.post("/chat")
async def chat(request: QueryRequest):
    return await async_chat_stream(request)

@app.get("/metadata")
async def metadata():
    return metadata_generator()

@app.get("/history/{user_id}")
async def history(user_id: str):
    return get_chat_history(user_id)

@app.delete("/history/{user_id}")
async def delete_history(user_id: str):
    clear_user_history(user_id)

@app.post("/load_documents")
async def load_docs(collection_name: str, force_reload: bool = False):
    return load_documents(collection_name, force_reload)

@app.get("/documents")
async def documents():
    return get_preprocessed_files()

@app.post("/upload_documents")
async def upload_doc(files: List[UploadFile] = File(...)):
    return await upload_documents(files)

@app.post("/delete_document")
def delete_doc(file_key: List[str]):
    return delete_document(file_key)

# Nuevo endpoint para ver documentos PDF en el navegador
@app.get("/view_document/{filename}")
async def view_document(filename: str):
    # Asegúrate de que esta 'base_directory' apunte a la carpeta donde se guardan tus PDFs
    # Es crucial que esta ruta sea accesible por tu servidor FastAPI
    base_directory = "C:\\Users\\panda\\OneDrive\\Documents\\mcd\\proyectoCenace\\datos\\documentos" # Ajusta esta ruta según tu configuración
    file_path = os.path.join(base_directory, filename)

    if os.path.exists(file_path):
        # Retorna el archivo con Content-Disposition: inline para que el navegador lo muestre
        return FileResponse(file_path, media_type="application/pdf", headers={"Content-Disposition": "inline"})
    else:
        raise HTTPException(status_code=404, detail="Documento no encontrado en el servidor.")

# uvicorn cenacellm.API.main:app --host 0.0.0.0 --port 80 --workers 4 --reload           // windows
# gunicorn -w 9 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:80 cenacellm.API.main:app   // linux
