from cenacellm.types import CallMetadata, Text, Chunks, Question
from abc import ABC, abstractmethod
from typing import Tuple
from string import Template

class Assistant(ABC):
    @abstractmethod
    def answer(self, q : Question, cs : Chunks) -> Tuple[Text, CallMetadata]:
        pass

    def answer_system(self) -> str:
        return (
            """
Eres un asistente que solo responde con base a las referencias que se te dan.
Nunca te inventas nada, siempre respondes de la información que tiene y
solo de la información que tienes.

Pero respondes de manera amable y quieres ser útil.
            """
        )

    def answer_user(self, q : Question, cs : Chunks) -> str:
        ref_tpl = Template(
            """            
Referencia ${n}: ${path} en ${ref}
${content}
            """
        )

        refs = ""
        for n, chunk in enumerate(cs):
            refs += ref_tpl.substitute(
                n = n + 1,
                path = chunk.metadata.source,
                ref = chunk.metadata.reference,
                content = chunk.content,
            )
        
        prompt_tpl = Template(
            """
Basado en las siguientes referencias responde la pregunta:

${refs}

Pregunta: ${question}
            """
        )
        return prompt_tpl.substitute(
            question=q,
            refs=refs,
        )
