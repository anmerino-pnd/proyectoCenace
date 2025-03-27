import faiss
import numpy as np
import pickle
import os
from typing import Dict, List, Tuple
from cenacellm.tools.embedder import Embedder
from cenacellm.tools.vectorstore import VectorStore


class FAISSVectorStore(VectorStore):
    def __init__(self, embeddings: Embedder, dim: int, index_path: str = None, dict_path: str = None):
        self.embeddings = embeddings
        self.index_path = index_path
        self.dict_path = dict_path or "faiss_text_dict.pkl"  # Ruta por defecto para guardar el diccionario
        self.text_dict: Dict[int, Tuple[np.ndarray, str]] = {}  # Diccionario para almacenar (vector, texto)

        # Cargar índice FAISS si existe
        if index_path and os.path.exists(index_path):
            self.index = faiss.read_index(index_path)
            print(f"Índice cargado desde {index_path}")
        else:
            print("No se encontró el archivo de índice, creando nuevo índice.")
            self.index = faiss.IndexFlatL2(dim)

        # Cargar diccionario si existe
        if os.path.exists(self.dict_path):
            with open(self.dict_path, "rb") as f:
                self.text_dict = pickle.load(f)
            print(f"Diccionario cargado desde {self.dict_path}")

    def get_similar(self, v: np.ndarray, k=5) -> List[Tuple[np.ndarray, str]]:
        v = np.array([v]).astype("float32")
        distances, indices = self.index.search(v, k)

        results = []
        for i in range(k):
            idx = indices[0][i]
            if idx == -1 or idx not in self.text_dict:
                break
            vector, texto = self.text_dict[idx]
            results.append((vector, texto))

        return results

    def add_text(self, v: np.ndarray, t: str):
        v = np.array([v]).astype("float32")
        self.index.add(v)
        idx = self.index.ntotal - 1  # Obtener el índice en FAISS
        self.text_dict[idx] = (v, t)  # Guardar en el diccionario
    

    def save_index(self):
        if self.index_path:
            faiss.write_index(self.index, self.index_path)
            print(f"Índice guardado en {self.index_path}")
        else:
            print("No se especificó una ruta para guardar el índice.")

        # Guardar el diccionario
        with open(self.dict_path, "wb") as f:
            pickle.dump(self.text_dict, f)
        print(f"Diccionario guardado en {self.dict_path}")

    def distance(self, v1: np.ndarray, v2: np.ndarray) -> float:
        v1 = np.array([v1]).astype("float32")
        v2 = np.array([v2]).astype("float32")
        return np.linalg.norm(v1 - v2)
