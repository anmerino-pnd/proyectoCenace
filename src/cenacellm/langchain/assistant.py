import time
from typing import Tuple
from cenacellm.clients import ollama_base_url
from langchain_ollama import ChatOllama
from langchain_ollama import OllamaEmbeddings
from cenacellm.langchain.rag import RAGassistant
from langchain.schema import AIMessage, HumanMessage
from cenacellm.langchain.history import ChatHistoryManager
from cenacellm.types import LLMAPIResponseError, CallMetadata, call_metadata, LLMError

class OllamaAssistant(RAGassistant):
    def __init__(self):
        self.model = "phi4"
        self.llm = ChatOllama(model=self.model, base_url=ollama_base_url)
        self.vector_path = r"C:\Users\panda\OneDrive\Documents\mcd\proyectoCenace\datos\vdb\ollama\pdfs"
        self.embedding_model = OllamaEmbeddings(model='jina/jina-embeddings-v2-base-es', base_url=ollama_base_url)
        super().__init__(llm=self.llm, VECTOR_DB_PATH=self.vector_path, embedding_model=self.embedding_model) 
        self.history = ChatHistoryManager()
        

    def inquiry(self, user_inquiry: str, user_id: str) -> dict:
        start_time = time.perf_counter()
        self.history.add_message(user_id, "human", user_inquiry) 

        res = self.prompt(user_inquiry, user_id)  # Ahora devuelve respuesta + documentos

        if res is None:
            raise LLMAPIResponseError(res, "assistant report")

        self.history.add_message(user_id, "system", res['answer']['answer'])  # Guardar solo el texto
        end_time = time.perf_counter()
        duration = end_time - start_time

        return {
            "answer": res['answer']['answer'],  # Ahora sí es un string
            "retrieved_documents": res["retrieved_documents"]  # Mantiene los documentos recuperados
        }


 