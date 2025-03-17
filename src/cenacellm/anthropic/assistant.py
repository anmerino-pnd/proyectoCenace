from cenacellm.clients import anthropic as api
from anthropic.types import Message

from cenacellm.tools.assistant import Assistant
from cenacellm.types import LLMAPIResponseError, LLMError, CallMetadata, call_metadata, Question, Text, Chunks, TextMetadata
from typing import Tuple, Optional
import time

class AnthropicAssistant(Assistant):
    def __init__(self):
        self.model = "claude-3-7-sonnet-latest"
        self.max_tokens = 1024

    def make_metadata(self, res : Message, duration : float) -> CallMetadata:
        usage = res.usage
        input_tokens = usage.input_tokens
        output_tokens = usage.output_tokens
        return call_metadata(
            provider="anthropic",
            model=self.model,
            operation="messages/create",
            duration=duration,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

    def prompt(self, system : str, user : str) -> Message:
        try:
            return api.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system,
                temperature=0,
                messages=[{"role": "user", "content": user}],
            )
        except Exception as e:
            raise LLMError("anthropic nerd", e)

    
    def answer(self, q : Question, cs : Chunks) -> Tuple[Text, CallMetadata]:
        system = self.answer_system()
        user = self.answer_user(q, cs)
        start_time = time.perf_counter()
        res = self.prompt(system, user)
        end_time = time.perf_counter()
        duration = end_time - start_time
        metadata = self.make_metadata(res, duration)
        if len(res.content) != 1:
            raise LLMAPIResponseError(res, "anthropic nerd answer")
        if res.stop_reason != "end_turn":
            raise LLMAPIResponseError(res, "anthropic nerd answer")
        if res.content[0].type != "text":
            raise LLMAPIResponseError(res, "anthropic nerd answer")
        return (
            Text(
                content=res.content[0].text,
                metadata=TextMetadata(
                    source=self.model,
                    reference=self.__class__.__name__,
                ),
            ),
            metadata
        )
