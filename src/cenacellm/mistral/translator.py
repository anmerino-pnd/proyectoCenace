from cenacellm.clients import mistral as api
from mistralai.extra import ParsedChatCompletionResponse

from cenacellm.tools.translator import Translator, DetectResult, LLMDetectResult, TranslateResult, LLMTranslateResult
from pydantic import BaseModel
from cenacellm.types import ElelemAPIResponseError, ElelemError, CallMetadata, call_metadata
from typing import Tuple
import time

class MistralTranslator(Translator):
    def __init__(self):
        self.model = "mistral-small-latest"

    def make_metadata(self, res : ParsedChatCompletionResponse, duration : float) -> CallMetadata:
        usage = res.usage
        input_tokens = usage.prompt_tokens
        output_tokens = usage.completion_tokens
        return call_metadata(
            provider="mistral",
            model=self.model,
            operation="chat/parse",
            duration=duration,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

    def prompt(self, system : str, schema : type[BaseModel], user : str) -> ParsedChatCompletionResponse:
        try:
            return api.chat.parse(
                model=self.model,
                temperature=0,
                response_format=schema,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
        except Exception as e:
            raise ElelemError("mistral translator", e)

    def validate_response(self, res : ParsedChatCompletionResponse):
        error = ElelemAPIResponseError(res, "mistral translator")
        if res.choices is None:
            raise error
        if len(res.choices) != 1:
            raise error
        message = res.choices[0].message
        if message is None:
            raise error
        parsed = message.parsed
        if parsed is None:
            raise error
        return parsed
        

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
