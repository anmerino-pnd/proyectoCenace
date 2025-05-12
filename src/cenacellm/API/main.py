from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from cenacellm.API.chat import (
    async_chat_stream,
    metadata_generator,
    clear_user_history,
    load_documents,
    QueryRequest,
    get_chat_history
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
    load_documents(collection_name, force_reload)
    return {"status": "ok", "message": f"Documents loaded for {collection_name}"}


# uvicorn cenacellm.API.main:app --host 0.0.0.0 --port 80 --workers 4 --reload           // windows 
# gunicorn -w 9 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:80 cenacellm.API.main:app   // linux