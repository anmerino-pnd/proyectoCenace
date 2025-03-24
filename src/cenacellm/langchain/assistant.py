import time
from typing import Tuple
from langchain_ollama import OllamaEmbeddings
from langchain_ollama import ChatOllama
from cenacellm.langchain.rag import RAGassistant
from cenacellm.langchain.history import ChatHistoryManager
from cenacellm.types import LLMAPIResponseError, CallMetadata, call_metadata, LLMError

class OllamaAssistant(RAGassistant):
    def __init__(self):
        self.model = "phi4"
        self.llm = ChatOllama(model=self.model)
        self.vector_path = r"C:\Users\panda\OneDrive\Documents\mcd\proyectoCenace\datos\vdb\ollama\knowledgeBase"
        self.embedding_model = OllamaEmbeddings(model='jina/jina-embeddings-v2-base-es')
        super().__init__(llm=self.llm, VECTOR_DB_PATH=self.vector_path, embedding_model=self.embedding_model) 
        self.history = ChatHistoryManager()
        

    def inquiry(self, user_inquiry: str, user_id: str) -> str:
        start_time = time.perf_counter()
        self.history.add_message(user_id, "human", user_inquiry) 
        res = self.prompt(user_inquiry, user_id)
        self.history.add_message(user_id, "system", res['answer'])
        end_time = time.perf_counter()
        duration = end_time - start_time
        #metadata = self.make_simple_metadata(callback, duration)
        if res is None:
            raise LLMAPIResponseError(res, "assistant report")
        return res['answer']
    
    

 