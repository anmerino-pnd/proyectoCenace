from cenacellm.tools.assistant import Assistant
from cenacellm.tools.embedder import Embedder
from cenacellm.tools.vectorstore import VectorStore
from cenacellm.tools.doccollection import DocCollection
from cenacellm.types import Text, Chunks, LLMError

class RAG:
    def __init__(
            self,
            model : Assistant,
            embedder : Embedder,
            vectorStore : VectorStore,
            documents : DocCollection,
    ):
        self.m = model
        self.e = embedder
        self.v = vectorStore
        self.d = documents

    def add_doc(self, t : Text):
        chunks = self.d.get_chunks(t)
        vectors = [
            self.e.vectorize(chunk.content)
            for chunk in chunks
        ]
        for vector, chunk in zip(vectors, chunks):
            ok = self.v.add_text(vector, chunk)
            if not ok:
                raise LLMError("Oh no!")

    def del_doc(self, t : Text):
        chunks = self.d.get_chunks(t)
        vectors = [
            self.e.vectorize(chunk.content)
            for chunk in chunks
        ]
        for vector in vectors:
            ok = self.v.del_text(vector)
            if not ok:
                raise LLMError("Oh no!")

    def answer(self, q : Text) -> Text:
        v = self.e.vectorize(q.content)
        S = self.v.get_similar(v)
        refs = [t for _, t in S]
        r, _ = self.m.answer(q, refs)
        return r
