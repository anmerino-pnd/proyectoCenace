from cenacellm.types import CallMetadata, Text, Chunks, Question
from abc import ABC, abstractmethod
from typing import Tuple
from string import Template

class Assistant(ABC):
    @abstractmethod
    def answer(self, q : Question, cs : Chunks) -> Tuple[Text, CallMetadata]:
        pass

    def answer_system(self, history) -> str:
        return Template(
            """
            Eres un asistente técnico especializado. 
            Siempre contesta de manera amable, clara y concisa.

            Tu objetivo es analizar la pregunta del usuario y responderla de manera precisa.
            Si se te pregunta por un problema o error, analiza, explica el problema y proporciona una solución.       

            Ten en cuenta el historial del usuario:
            ${history}   
            """
        ).substitute(history=history)

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
Basado en las siguientes referencias responde la pregunta del usuario de manera clara y concisa:


${refs}

Pregunta: ${question}


            """
        )
        return prompt_tpl.substitute(
            question=q,
            refs=refs,
        )
