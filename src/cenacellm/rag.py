from cenacellm.doccollection import DocCollection
from cenacellm.vectorstore import VectorStore
from cenacellm.ollama.assistant import Assistant
from cenacellm.ollama.embedder import Embedder
from cenacellm.types import Text, Chunks, LLMError

class RAG:
    def __init__(
            self, 
            model: Assistant, 
            embedder: Embedder, 
            vectorStore: VectorStore, 
            documents: DocCollection
    ):
        self.m = model
        self.e = embedder
        self.v = vectorStore
        self.d = documents
        
    def add_doc(self, t):
        chunks = self.d.get_chunks(t)
        vectors = [self.e.vectorize(chunk.content) for chunk in chunks]
        for vector, chunk in zip(vectors, chunks):
            ok = self.v.add_text(vector, chunk)
            if not ok:
                raise LLMError("Oh no!")

    def answer(self, q):
        v = self.e.vectorize(q.content)
        S = self.v.get_similar(v)
        refs = [t for _, t in S]
        r, _ = self.m.answer(q, refs)
        return r