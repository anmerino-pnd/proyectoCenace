
from cenacellm.clients import ollama as api
from ollama import GenerateResponse

from cenacellm.tools.assistant import Assistant
from cenacellm.types import LLMError, CallMetadata, call_metadata, Question, Text, Chunks, TextMetadata
from typing import Tuple, Optional
import time

class OllamaAssistant(Assistant):
    def __init__(self):
        self.model = "phi4:latest"
        
    def make_metadata(self, res : GenerateResponse, duration : float) -> CallMetadata:
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
    
    def prompt(self, system : str, user : str) -> GenerateResponse:
        try:
            return api.generate(
                model=self.model,
                system=system,
                options={
                    "temperature": 0,
                },
                user=user,
            )
        except Exception as e:
            raise LLMError("ollama assistant", e)
        
    def answer(self, q : Question, cs : Chunks) -> Tuple[Text, CallMetadata]:
        system = self.answer_system()
        user = self.answer_user(q, cs)
        start_time = time.perf_counter()
        res = self.prompt(system, user)
        end_time = time.perf_counter()
        duration = end_time - start_time
        metadata = self.make_metadata(res, duration)
        return (
            Text(
                content=res.response,
                metadata=TextMetadata(
                    source=self.model,
                    reference=self.__class__.__name__,
                ),
            ),
            metadata,
        )