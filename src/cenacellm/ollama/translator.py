from cenacellm.clients import ollama as api
from ollama import GenerateResponse

from cenacellm.tools.translator import Translator, DetectResult, LLMDetectResult, TranslateResult, LLMTranslateResult
from pydantic import BaseModel, ValidationError
from cenacellm.types import ElelemAPIResponseError, ElelemError, CallMetadata, call_metadata
from typing import Tuple
import time

class OllamaTranslator(Translator):
    def __init__(self):
        self.model = "gemma2:9b"

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

    def prompt(self, system : str, schema : type[BaseModel], user : str) -> GenerateResponse:
        try:
            return api.generate(
                model=self.model,
                system=system,
                format=schema.model_json_schema(),
                options={
                    "temperature": 0,
                },
                prompt=user,
            )
        except Exception as e:
            raise ElelemError("ollama translator", e)

    def detect(self, src_text : str) -> Tuple[DetectResult, CallMetadata]:
        system = self.detect_system()
        user = self.detect_user(src_text)
        start_time = time.perf_counter()
        res = self.prompt(system, LLMDetectResult, user)
        end_time = time.perf_counter()
        duration = end_time - start_time
        metadata = self.make_metadata(res, duration)
        try:
            parsed = LLMDetectResult.model_validate_json(res.response)
            return (
                DetectResult(
                    src_text=src_text,
                    src_lang=parsed.src_lang,
                ),
                metadata,
            )
        except ValidationError as e:
            raise ElelemAPIResponseError(res, "ollama translator detect", e)

    def translate(self, src_text : str, tgt_lang : str) -> Tuple[TranslateResult, CallMetadata]:
        system = self.translate_system()
        user = self.translate_user(src_text, tgt_lang)
        start_time = time.perf_counter()
        res = self.prompt(system, LLMTranslateResult, user)
        end_time = time.perf_counter()
        duration = end_time - start_time
        metadata = self.make_metadata(res, duration)
        try:
            parsed = LLMTranslateResult.model_validate_json(res.response)
            return (
                TranslateResult(
                    src_text=src_text,
                    src_lang=parsed.src_lang,
                    tgt_text=parsed.tgt_text,
                    tgt_lang=tgt_lang,
                ),
                metadata,
            )
        except ValidationError as e:
            raise ElelemAPIResponseError(res, "ollama translator translate", e)
