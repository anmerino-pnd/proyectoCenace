from cenacellm.clients import openai as api
from openai.types.chat import ParsedChatCompletion, ChatCompletion

from cenacellm.tools.journalist import Journalist, ChecklistResult, LLMChecklistResult
from cenacellm.types import ElelemAPIResponseError, ElelemError, CallMetadata, call_metadata
from pydantic import BaseModel
from typing import Tuple
import time

class OpenAIJournalist(Journalist):
    def __init__(self):
        self.model = "gpt-4o-mini"

    def make_simple_metadata(self, res : ChatCompletion, duration : float) -> CallMetadata:
        usage = res.usage
        input_tokens = usage and usage.prompt_tokens
        output_tokens = usage and usage.completion_tokens
        return call_metadata(
            provider="openai",
            model=self.model,
            operation="chat/completions/create",
            duration=duration,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

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

    def simple_prompt(self, system : str, user : str) -> ChatCompletion:
        try:
            return api.chat.completions.create(
                model=self.model,
                temperature=0,
                messages=[
                    {"role": "developer",
                     "content": [{"type": "text", "text": system}]},
                    {"role": "user",
                     "content": [{"type": "text","text": user}]},
                ],
            )
        except Exception as e:
            raise ElelemError("openai journalist", e)

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
            raise ElelemError("openai journalist", e)

    def validate_response(self, res : ParsedChatCompletion):
        error = ElelemAPIResponseError(res, "openai journalist")
        if len(res.choices) != 1:
            raise error
        message = res.choices[0].message
        if message.refusal:
            raise error
        if message.parsed is None:
            raise error
        return message.parsed

    def combine_metadata(self, md1 : CallMetadata, md2 : CallMetadata) -> CallMetadata:
        return call_metadata(
            provider="openai",
            model=f"chain[{md1.model},{md2.model}]",
            operation=f"chain[{md1.operation},{md2.operation}]",
            duration=md1.duration + md2.duration,
            input_tokens=(md1.input_tokens or 0) + (md2.input_tokens or 0),
            output_tokens=(md1.output_tokens or 0) + (md2.output_tokens or 0),
        )

    def analyze_and_report(self, incident : str) -> Tuple[str, CallMetadata]:
        cl, md1 = self.checklist(incident)
        txt, md2 = self.report(cl)
        return txt, self.combine_metadata(md1, md2)

    def report(self, cl : ChecklistResult) -> Tuple[str, CallMetadata]:
        system = self.report_system()
        user = self.report_user(cl)
        start_time = time.perf_counter()
        res = self.simple_prompt(system, user)
        end_time = time.perf_counter()
        duration = end_time - start_time
        metadata = self.make_simple_metadata(res, duration)
        rep_txt = res.choices[0].message.content
        if rep_txt is None:
            raise ElelemAPIResponseError(res, "journalist report")
        return (
            rep_txt,
            metadata,
        )

    def checklist(self, incident : str) -> Tuple[ChecklistResult, CallMetadata]:
        system = self.checklist_system()
        user = self.checklist_user(incident)
        start_time = time.perf_counter()
        res = self.prompt(system, LLMChecklistResult, user)
        end_time = time.perf_counter()
        duration = end_time - start_time
        metadata = self.make_metadata(res, duration)
        parsed = self.validate_response(res)
        return (
            ChecklistResult(
                incident=incident,
                who=parsed.who,
                what=parsed.what,
                when=parsed.when,
                where=parsed.where,
                why=parsed.why,
                how=parsed.how,
            ),
            metadata,
        )
