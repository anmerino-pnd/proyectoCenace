from cenacellm.clients import openai as api
from openai.types.chat import ParsedChatCompletion

from cenacellm.tools.translator import Translator, DetectResult, LLMDetectResult, TranslateResult, LLMTranslateResult
from pydantic import BaseModel
from cenacellm.types import ElelemAPIResponseError, ElelemError, CallMetadata, call_metadata
from typing import Tuple
import time

class OpenAITranslator(Translator):
    def __init__(self):
        self.model = "gpt-4o-mini"

    def make_metadata(self, res : ParsedChatCompletion, duration : float) -> CallMetadata:
        usage = res.usage
        input_tokens = usage and usage.prompt_tokens
        output_tokens = usage and usage.completion_tokens
        return call_metadata(
            provider="openai",
            model=self.model,
            operation="beta/chat/completions/parse",
            duration=duration,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

    def prompt(self, system : str, schema : type[BaseModel], user : str) -> ParsedChatCompletion:
        try:
            return api.beta.chat.completions.parse(
                model=self.model,
                temperature=0,
                response_format=schema,
                messages=[
                    {"role": "developer",
                     "content": [{"type": "text", "text": system}]},
                    {"role": "user",
                     "content": [{"type": "text","text": user}]},
                ],
            )
        except Exception as e:
            raise ElelemError("openai translator", e)

    def validate_response(self, res : ParsedChatCompletion):
        error = ElelemAPIResponseError(res, "openai translator")
        if len(res.choices) != 1:
            raise error
        message = res.choices[0].message
        if message.refusal:
            raise error
        if message.parsed is None:
            raise error
        return message.parsed

    def detect(self, src_text : str) -> Tuple[DetectResult, CallMetadata]:
        system = self.detect_system()
        user = self.detect_user(src_text)
        start_time = time.perf_counter()
        res = self.prompt(system, LLMDetectResult, user)
        end_time = time.perf_counter()
        duration = end_time - start_time
        metadata = self.make_metadata(res, duration)
        parsed = self.validate_response(res)
        return (
            DetectResult(
                src_text=src_text,
                src_lang=parsed.src_lang,
            ),
            metadata,
        )

    def translate(self, src_text : str, tgt_lang : str) -> Tuple[TranslateResult, CallMetadata]:
        system = self.translate_system()
        user = self.translate_user(src_text, tgt_lang)
        start_time = time.perf_counter()
        res = self.prompt(system, LLMTranslateResult, user)
        end_time = time.perf_counter()
        duration = end_time - start_time
        metadata = self.make_metadata(res, duration)
        parsed = self.validate_response(res)
        return (
            TranslateResult(
                src_text=src_text,
                src_lang=parsed.src_lang,
                tgt_text=parsed.tgt_text,
                tgt_lang=tgt_lang,
            ),
            metadata,
        )
