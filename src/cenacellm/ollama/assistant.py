import os
import json
import time
from typing import Generator
from ollama import GenerateResponse
from cenacellm.clients import ollama as api

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
        self.history_file = HISTORY_FILE
        self._ensure_history_file()
        self.histories = self.load_history()

    def _ensure_history_file(self):
        os.makedirs(os.path.dirname(self.history_file), exist_ok=True)
        if not os.path.exists(self.history_file):
            with open(self.history_file, "w", encoding="utf-8") as f:
                json.dump({}, f, indent=4, ensure_ascii=False)

    def load_history(self) -> dict:
        with open(self.history_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def save_history(self):
        with open(self.history_file, "w", encoding="utf-8") as f:
            json.dump(self.histories, f, indent=4, ensure_ascii=False)

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

        history = self.histories.get(user_id, [])
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

        # Actualizar historial con nueva entrada
        new_entries = window + [
            {"role": "user", "content": q},
            {"role": "assistant", "content": response, "metadata": metadata.model_dump()},
        ]
        self.histories[user_id] = new_entries
        self.save_history()
