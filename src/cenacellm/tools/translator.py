from cenacellm.types import CallMetadata
from pydantic import BaseModel, Field
from typing import Optional, Tuple
from abc import ABC, abstractmethod
from string import Template
import time
import json

class LLMDetectResult(BaseModel):
    src_lang : str = Field(description="Language of the source text")

class DetectResult(BaseModel):
    src_lang : str = Field(description="Language of the source text")
    src_text : str = Field(description="Source text")

class LLMTranslateResult(BaseModel):
    src_lang : str = Field(description="Language of the source text")
    tgt_text : Optional[str] = Field(description="Translated text, or null if already in the desired target language")

class TranslateResult(BaseModel):
    src_lang : str = Field(description="Language of the source text")
    src_text : str = Field(description="Source text")
    tgt_lang : str = Field(description="Language of the target text")
    tgt_text : Optional[str] = Field(description="Target text")

class Translator(ABC):
    @abstractmethod
    def detect(self, src_text : str) -> Tuple[DetectResult, CallMetadata]:
        pass
    
    @abstractmethod
    def translate(self, src_text : str, tgt_lang : str) -> Tuple[TranslateResult, CallMetadata]:
        pass

    def detect_system(self) -> str:
        return (
            "You are an expert translator fluent in many languages. You will be " \
            "provided with a source text and a target language.  Your task is to " \
            "accurately translate the source text into the target language, while " \
            "preserving the original meaning and style as closely as possible. You " \
            "will also identify the source language of the text. "
        )

    def detect_user(self, src_text : str) -> str:
        tpl = Template(
            "Determine the source language of the following text:\n\n" \
            "${src_text}"
        )
        return tpl.substitute(src_text=src_text)

    def translate_system(self) -> str:
        return (
            "You are an expert translator fluent in many languages. You will be " \
            "provided with a source text and a target language.  Your task is to " \
            "accurately translate the source text into the target language, while " \
            "preserving the original meaning and style as closely as possible. You " \
            "will also identify the source language of the text. "
        )

    def translate_user(self, src_text : str, tgt_lang : str) -> str:
        tpl = Template(
            "Please translate the following text into ${tgt_lang} and tell me the " \
            "language of the original text:\n\n" \
            "${src_text}"
        )
        return tpl.substitute(src_text=src_text, tgt_lang=tgt_lang)
