from cenacellm.clients import ollama as api
from openai.types.chat import ParsedChatCompletion, ChatCompletion


from cenacellm.tools.journalist import Journalist, ChecklistResult, LLMChecklistResult
from cenacellm.types import LLMAPIResponseError, LLMError, CallMetadata, call_metadata
from pydantic import BaseModel
from typing import Tuple
import time

class OllamaJournalist(Journalist):
    def __init__(self):
        self.model = "phi4:latest"


    def make_simple_metadata(self, res : ChatCompletion, duration : float) -> CallMetadata:
        usage = res.usage
        input_tokens = usage and usage.prompt_tokens
        output_tokens = usage and usage.completion_tokens
        return call_metadata(
            provider="ollama",
            model=self.model,
            operation="generate",
            duration=duration,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )
    
    def make_metadata(self, res : ParsedChatCompletion, duration : float) -> CallMetadata:
        usage = res.usage
        input_tokens = usage and usage.prompt_tokens
        output_tokens = usage and usage.completion_tokens
        return call_metadata(
            provider="ollama",
            model=self.model,
            operation="generate",
            duration=duration,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )
    
    def simple_prompt(self, system : str, user : str) -> ChatCompletion:
        try:
            return api.generate(
                model=self.model,
                system=system,
                options={
                    "temperature": 0,
                },
                prompt=user,
            )
        except Exception as e:
            raise LLMError("ollama journalist", e)
        
    def validate_response(self, res : ParsedChatCompletion):
        error = LLMAPIResponseError(res, "ollama journalist")
        if error.is_error():
            raise error
        if not res.choices:
            raise LLMError("ollama journalist", "no choices in response")
        if not res.choices[0].message:
            raise LLMError("ollama journalist", "no message in response")
        return res.choices[0].message.content
    
    def combine_metadata(self, md1 : CallMetadata, md2 : CallMetadata) -> CallMetadata:
        return call_metadata(
            provider=md1.provider,
            model=md1.model,
            operation=md1.operation,
            duration=md1.duration + md2.duration,
            input_tokens=md1.input_tokens + md2.input_tokens,
            output_tokens=md1.output_tokens + md2.output_tokens,
        )
    
    def analyze_and_report(self, incident : str) -> Tuple[str, CallMetadata]:
        cl, md1 = self.checklist(incident)
        txt, md2 = self.report(incident)
        return txt, self.combine_metadata(md1, md2)
    
    def report(self, cl : ChecklistResult) -> Tuple[str, CallMetadata]:
        system = self.report_system()
        user = self.report_user(cl)
        start_time = time.perf_counter()
        res = self.simple_prompt(system, user)
        end_time = time.perf_counter()
        duration = end_time - start_time
        metadata = self.make_simple_metadata(res, duration)
        return res.choices[0].message.content, metadata
    
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
                where=parsed.where,
                when=parsed.when,
                why=parsed.why,
                how=parsed.how,
            ),
            metadata,
        )