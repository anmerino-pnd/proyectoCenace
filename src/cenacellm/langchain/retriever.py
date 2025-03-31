import os
from langchain.vectorstores import FAISS


class VectorStore:
    def __init__(self, VECTOR_DB_PATH, embedding_model):
        """Carga la base de datos vectorial con el modelo de embeddings correcto."""
        self.VECTOR_DB_PATH = VECTOR_DB_PATH
        self.embedding_model = embedding_model

    def load_retriever(self):
        """Carga FAISS si existe, sino lanza error."""
        if os.path.exists(self.VECTOR_DB_PATH):
            return FAISS.load_local(self.VECTOR_DB_PATH, self.embedding_model, allow_dangerous_deserialization=True)
        else:
            raise FileNotFoundError(f"No se encontró la base de datos en {self.VECTOR_DB_PATH}")

    def asRetriever(self, search_kwargs = {"k": 10}):
        """Carga la base de datos vectorial."""
        vdb = self.load_retriever()
        return vdb.as_retriever(search_kwargs=search_kwargs)
