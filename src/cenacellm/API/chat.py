from cenacellm.rag import RAG
from pydantic import BaseModel
from typing import AsyncGenerator
from fastapi.responses import StreamingResponse
from cenacellm.config import VECTORS_DIR, DOCUMENTS_DIR


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
    filter_metadata = request.filter_metadata

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
    return rag.get_processed_documents()






    

