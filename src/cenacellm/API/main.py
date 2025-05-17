import os
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse 
from cenacellm.API.chat import (
    async_chat_stream,
    metadata_generator,
    clear_user_history,
    load_documents,
    QueryRequest,
    get_chat_history,
    get_preprocessed_files,
    DOCUMENTS_DIR
)

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

@app.post("/upload_document")
async def upload_document(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF.")

    file_location = os.path.join(DOCUMENTS_DIR, file.filename)

    try:
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar el archivo: {e}")

    return JSONResponse(content={"filename": file.filename, "message": "Archivo subido con éxito"})



# uvicorn cenacellm.API.main:app --host 0.0.0.0 --port 80 --workers 4 --reload           // windows 
# gunicorn -w 9 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:80 cenacellm.API.main:app   // linux