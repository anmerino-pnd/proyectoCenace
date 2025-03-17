from cenacellm.types import CallMetadata
from pydantic import BaseModel, Field
from typing import Tuple
from abc import ABC, abstractmethod
from string import Template

class LLMChecklistResult(BaseModel):
    who : str = Field(description="Who is involved?")
    what : str = Field(description="What happened?")
    when : str = Field(description="When did it happen?")
    where : str = Field(description="Where did it happen?")
    why : str = Field(description="Why did it happen?")
    how : str = Field(description="How did it happen?")

class ChecklistResult(BaseModel):
    incident : str = Field(description="Original description of the incident")
    who : str = Field(description="Who is involved?")
    what : str = Field(description="What happened?")
    when : str = Field(description="When did it happen?")
    where : str = Field(description="Where did it happen?")
    why : str = Field(description="Why did it happen?")
    how : str = Field(description="How did it happen?")

class Journalist(ABC):
    @abstractmethod
    def checklist(self, incident : str) -> Tuple[ChecklistResult, CallMetadata]:
        pass

    @abstractmethod
    def report(self, cl : ChecklistResult) -> Tuple[str, CallMetadata]:
        pass

    def report_system(self) -> str:
        return "Eres un magnífico reportero que escribe con una prosa impecable y con un rigor periodístico de primera."

    def report_user(self, cl : ChecklistResult) -> str:
        tpl = Template(
            "Genera un reporte basado en el siguiente checklist en formato JSON:\n\n${checklist}"
        )
        return tpl.substitute(checklist=cl.model_dump_json(indent=2))

    def checklist_system(self) -> str:
        return (
            "Eres un asistente de IA útil e informativo. " \
            "Tu tarea es analizar un texto proporcionado " \
            "por el usuario que describe un incidente y " \
            "extraer la información clave correspondiente " \
            "a las cinco preguntas (Quién, Qué, Cuándo, " \
            "Dónde, Por qué) y un Cómo del periodismo.\n\n " \
            "Si el texto proporcionado por el usuario no " \
            "indica explícitamente un elemento, haz tu mejor " \
            "inferencia basándote en el contexto y la " \
            "información disponible. Si no hay información " \
            "disponible para un elemento específico, " \
            "simplemente indica \"No especificado\". " \
            "Presta especial atención a las fechas y cuándo es que el incidente ocurrió."
        )

    def checklist_user(self, incident : str) -> str:
        tpl = Template(
            "Genera respuestas a las preguntas sobre " \
            "este incidente:\n\nIncidente:\n${incident}"
        )
        return tpl.substitute(incident=incident)


