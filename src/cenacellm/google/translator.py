from cenacellm.clients import google as api
from google.genai.types import GenerateContentConfig, GenerateContentResponse
from cenacellm.tools.translator import Translator, DetectResult, LLMDetectResult, TranslateResult, LLMTranslateResult
from pydantic import BaseModel
from cenacellm.types import ElelemAPIResponseError, ElelemError, CallMetadata, call_metadata
from typing import Tuple
import time

class GoogleTranslator(Translator):
    def __init__(self):
        self.model = "gemini-2.0-flash-lite-preview-02-05"

    def make_metadata(self, res : GenerateContentResponse, duration : float) -> CallMetadata:
        usage = res.usage_metadata
        input_tokens = usage and usage.prompt_token_count
        output_tokens = usage and usage.candidates_token_count
        return call_metadata(
            provider="google",
            model=self.model,
            operation="models/generate_content",
            duration=duration,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

    def make_config(self, system : str, schema : type[BaseModel]) -> GenerateContentConfig:
        return GenerateContentConfig(
            system_instruction=system,
            temperature=0,
            response_mime_type="application/json",
            response_schema=schema,
        )

    def prompt(self, config : GenerateContentConfig, user : str) -> GenerateContentResponse:
        try:
            return api.models.generate_content(
                model=self.model,
                config=config,
                contents=user,
            )
        except Exception as e:
            raise ElelemError("google translator", e)

    def detect(self, src_text : str) -> Tuple[DetectResult, CallMetadata]:
        system = self.detect_system()
        user = self.detect_user(src_text)
        config = self.make_config(system, LLMDetectResult)
        start_time = time.perf_counter()
        res = self.prompt(config, user)
        end_time = time.perf_counter()
        duration = end_time - start_time
        metadata = self.make_metadata(res, duration)
        parsed = res.parsed
        if not isinstance(parsed, LLMDetectResult):
            raise ElelemAPIResponseError(res, "google translator detect")
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
        config = self.make_config(system, LLMTranslateResult)
        start_time = time.perf_counter()
        res = self.prompt(config, user)
        end_time = time.perf_counter()
        duration = end_time - start_time
        metadata = self.make_metadata(res, duration)
        parsed = res.parsed
        if not isinstance(parsed, LLMTranslateResult):
            raise ElelemAPIResponseError(res, "google translator translate")
        return (
            TranslateResult(
                src_text=src_text,
                src_lang=parsed.src_lang,
                tgt_text=parsed.tgt_text,
                tgt_lang=tgt_lang,
            ),
            metadata,
        )
