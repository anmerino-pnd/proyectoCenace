import faiss
import numpy as np
from typing import List, Tuple
from cenacellm.tools.embedder import Embedder
from cenacellm.tools.vectorstore import VectorStore


class FAISSVectorStore(VectorStore):
    def __init__(self, embeddings: Embedder, dim: int, index_path: str = None):
        self.embeddings = embeddings # Todos los embedders tengan que decir la dimension que manejan
        self.index_path = index_path 
        self.texts = []  # Lista para almacenar los textos
        self.vectors = []  # Lista para almacenar los vectores originales

        if index_path:
            try:
                self.index = faiss.read_index(index_path)  # Intentar cargar índice
                print(f"Índice cargado desde {index_path}")
            except:
                print("No se encontró el archivo, creando nuevo índice.")
                self.index = faiss.IndexFlatL2(dim)
        else:
            self.index = faiss.IndexFlatL2(dim)

    def get_similar(self, v: np.ndarray, k=5) -> List[Tuple[np.ndarray, str]]:
        v = np.array([v]).astype('float32')
        distances, indices = self.index.search(v, k)

        results = []
        for i in range(k):
            if indices[0][i] == -1:
                break
            vector = self.vectors[indices[0][i]]
            texto = self.texts[indices[0][i]]
            results.append((vector, texto))  # Devuelve (vector, texto)

        return results

    def add_text(self, v: np.ndarray, t: str): #pasarle diccionario no lista, asociarlo, saque un pkl
        v = np.array([v]).astype('float32')
        self.index.add(v)
        self.vectors.append(v)  # Guardar vector original
        self.texts.append(t)  # Guardar texto original

    def save_index(self):
        if self.index_path:
            faiss.write_index(self.index, self.index_path)
            print(f"Índice guardado en {self.index_path}")
        else:
            print("No se especificó una ruta para guardar el índice.")

    def distance(self, v1: np.ndarray, v2: np.ndarray) -> float:
        v1 = np.array([v1]).astype('float32')
        v2 = np.array([v2]).astype('float32')
        return np.linalg.norm(v1 - v2)
