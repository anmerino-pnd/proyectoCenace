import os
import json
import time
from typing import Generator
from pymongo import MongoClient
from bson.objectid import ObjectId
from ollama import GenerateResponse
from cenacellm.clients import ollama as api, mongo_uri, db_name

from cenacellm.config import HISTORY_FILE
from cenacellm.tools.assistant import Assistant
from cenacellm.types import (
    LLMError,
    CallMetadata,
    call_metadata,
    Question,
    Chunks,
)

class OllamaAssistant(Assistant):
    def __init__(self, memory_window_size: int = 1):
        self.model = "phi4:latest"
        self.memory_window_size = memory_window_size

        self.mongo_uri = mongo_uri
        self.db_name = db_name
        self.collection_name = "user_histories"

        self.client = MongoClient(self.mongo_uri)
        self.db = self.client[self.db_name]
        self.collection = self.db[self.collection_name]


    def load_history(self, user_id: str) -> list:
        doc = self.collection.find_one({"user_id": user_id})
        return doc["history"] if doc else []

    def save_history(self, user_id: str, history: list):
        self.collection.update_one(
            {"user_id": user_id},
            {"$set": {"history": history}},
            upsert=True
        )

    def clear_user_history(self, user_id: str):
        self.collection.delete_one({"user_id": user_id})
        self.save_history(user_id, [])


    def make_metadata(self, res: GenerateResponse, duration: float) -> CallMetadata:
        input_tokens = res.prompt_eval_count
        output_tokens = res.eval_count
        return call_metadata(
            provider="ollama",
            model=self.model,
            operation="generate",
            duration=duration,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

    def answer(self, q: Question, cs: Chunks, user_id: str) -> Generator[str, None, None]:
        user_msg = self.answer_user(q, cs)
        system = self.answer_system()

        history: list = self.load_history(user_id)
        window = history[-self.memory_window_size:]

        if window:
            past = "\n".join([f"{m['role']}: {m['content']}" for m in window])
            prompt = past + "\nuser: " + user_msg
        else:
            prompt = user_msg

        try:
            start_time = time.perf_counter()
            response = ""
            for chunk in api.generate(
                model=self.model,
                system=system,
                options={"temperature": 0},
                prompt=prompt,
                stream=True
            ):
                if hasattr(chunk, "response"):
                    token = chunk.response
                    response += token
                    yield token
            end_time = time.perf_counter()
        except Exception as e:
            raise LLMError("ollama assistant", e)

        duration = end_time - start_time
        metadata = self.make_metadata(chunk, duration)

        history.append({"role": "user", "content": q})
        history.append({"role": "assistant", "content": response, "metadata": metadata.model_dump()})

        self.save_history(user_id, history)
