import time
from typing import Tuple
from langchain_openai import ChatOpenAI
from langchain_openai import OpenAIEmbeddings
from langchain_community.callbacks import get_openai_callback
from langchain_community.callbacks.openai_info import OpenAICallbackHandler

from cenacellm.clients import openai_api_key as api
from cenacellm.langchain.rag import RAGassistant
from cenacellm.langchain.history import ChatHistoryManager
from cenacellm.types import LLMAPIResponseError, CallMetadata, call_metadata, LLMError

class OpenAIAssistant(RAGassistant):
    def __init__(self):
        self.model = "gpt-4o-mini"
        self.llm = ChatOpenAI(model=self.model, api_key=api, temperature=0)
        self.vector_path = r"C:\Users\panda\OneDrive\Documents\mcd\proyectoCenace\datos\vdb\openai"
        self.embedding_model = OpenAIEmbeddings(api_key=api)
        super().__init__(llm=self.llm, VECTOR_DB_PATH=self.vector_path, embedding_model=self.embedding_model) 
        self.history = ChatHistoryManager()
        

    def offer(self, user_enquery: str, user_id: str, listaPrecio: str) -> Tuple[str, float]:
        start_time = time.perf_counter()
        self.history.add_message(user_id, "human", user_enquery) 
        with get_openai_callback() as callback:
            res = self.prompt(user_enquery, user_id, listaPrecio)
        self.history.add_message(user_id, "system", res['answer'])
        end_time = time.perf_counter()
        duration = end_time - start_time
        metadata = self.make_simple_metadata(callback, duration)
        if res is None:
            raise LLMAPIResponseError(res, "assistant report")
        return (
            res['answer'],
            metadata,
        )
    
    def make_simple_metadata(self, cb : OpenAICallbackHandler, duration : float) -> CallMetadata:
        input_tokens = cb.prompt_tokens
        output_tokens = cb.completion_tokens
        return call_metadata(
            provider="openai",
            model=self.model,
            operation="openai/callback",
            duration=duration,
            input_tokens=input_tokens,
            output_tokens=output_tokens
        )

 