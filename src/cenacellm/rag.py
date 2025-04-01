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
        self.model = model
        self.embedder = embedder
        self.vectorStore = vectorStore
        self.documents = documents
        
    def add_doc(self, t):
        chunks = self.documents.get_chunks(t)
        vectors = [self.embedder.vectorize(chunk.content) for chunk in chunks]
        for vector, chunk in zip(vectors, chunks):
            ok = self.vectorStore.add_text(vector, chunk)
            if not ok:
                raise LLMError("Oh no!")

    def answer(self, q):
        v = self.embedder.vectorize(q.content)
        S = self.vectorStore.get_similar(v)
        refs = [t for _, t in S]
        r, _ = self.model.answer(q, refs)
        return r