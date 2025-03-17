from cenacellm.clients import anthropic as api
from anthropic.types import ToolParam, Message, ToolUseBlock

from cenacellm.tools.translator import Translator, DetectResult, LLMDetectResult, TranslateResult, LLMTranslateResult
from pydantic import ValidationError
from cenacellm.types import ElelemAPIResponseError, ElelemError, CallMetadata, call_metadata
from typing import Tuple, Optional
import time

class AnthropicTranslator(Translator):
    def __init__(self):
        self.model = "claude-3-5-haiku-latest"
        self.max_tokens = 1024
        self.tools = [
            ToolParam(
                name="detect-language",
                description="Accurately identifies the language of the given text.",
                input_schema=LLMDetectResult.model_json_schema(),
            ),
            ToolParam(
                name="detect-and-translate-language",
                description="Identifies the language of the source text and provides an accurate translation to the specified target language.",
                input_schema=LLMTranslateResult.model_json_schema(),
            ),
        ]

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

    def prompt(self, system : str, tool : str, user : str) -> Message:
        try:
            return api.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system,
                temperature=0,
                tools=self.tools,
                tool_choice={"type": "tool", "name": tool},
                messages=[{"role": "user", "content": user}],
            )
        except Exception as e:
            raise ElelemError("anthropic translator", e)

    def extract_tool_use(self, res : Message) -> Optional[ToolUseBlock]:
        if res.stop_reason != "tool_use":
            return None
        for block in res.content:
            if isinstance(block, ToolUseBlock):
                return block
        return None
        
    def detect(self, src_text : str) -> Tuple[DetectResult, CallMetadata]:
        system = self.detect_system()
        user = self.detect_user(src_text)
        tool = "detect-language"
        start_time = time.perf_counter()
        res = self.prompt(system, tool, user)
        end_time = time.perf_counter()
        duration = end_time - start_time
        metadata = self.make_metadata(res, duration)
        tool_use = self.extract_tool_use(res)
        if tool_use is None or tool_use.name != tool:
            raise ElelemAPIResponseError(res, "anthropic translator detect")
        try:
            parsed = LLMDetectResult.model_validate(tool_use.input)
            return (
                DetectResult(
                    src_text=src_text,
                    src_lang=parsed.src_lang,
                ),
                metadata,
            )
        except ValidationError as e:
            raise ElelemAPIResponseError(res, "anthropic translator detect", e)

    def translate(self, src_text : str, tgt_lang : str) -> Tuple[TranslateResult, CallMetadata]:
        system = self.translate_system()
        user = self.translate_user(src_text, tgt_lang)
        tool = "detect-and-translate-language"
        start_time = time.perf_counter()
        res = self.prompt(system, tool, user)
        end_time = time.perf_counter()
        duration = end_time - start_time
        metadata = self.make_metadata(res, duration)
        tool_use = self.extract_tool_use(res)
        if tool_use is None or tool_use.name != tool:
            raise ElelemAPIResponseError(res, "anthropic translator translate")
        try:
            parsed = LLMTranslateResult.model_validate(tool_use.input)
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
            raise ElelemAPIResponseError(res, "anthropic translator translate", e)

    
