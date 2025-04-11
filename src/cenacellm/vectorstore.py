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
        self.text_dict: Dict[int, Tuple[np.ndarray, str, Dict[str, str]]] = {}

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

    def get_similar(self, v: np.ndarray, k=5, filter_metadata: Dict[str, str] = None) -> List[Tuple[np.ndarray, Text]]:
        v = np.array([v]).astype("float32")
        distances, indices = self.index.search(v, k * 5)  # busca más de lo necesario

        results = []
        for i in range(len(indices[0])):
            idx = indices[0][i]
            if idx == -1 or idx not in self.text_dict:
                continue

            vector, text = self.text_dict[idx]

            if filter_metadata:
                if not all(text.metadata.dict().get(k) == v for k, v in filter_metadata.items()):
                    continue

            results.append((vector, text))
            if len(results) >= k:
                break

        return results



    def add_text(self, v: np.ndarray, t: str, metadata: Dict[str, str] = None):
        v = np.array([v]).astype("float32")
        self.index.add(v)
        idx = self.index.ntotal - 1
        self.text_dict[idx] = (v, t, metadata or {})

    

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
