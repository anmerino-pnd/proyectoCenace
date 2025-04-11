import faiss
import numpy as np
import pickle
import os
from typing import Dict, List, Tuple
from cenacellm.types import Text
from cenacellm.tools.embedder import Embedder
from cenacellm.tools.vectorstore import VectorStore
from pathlib import Path

class FAISSVectorStore(VectorStore):
    def __init__(self, embeddings: Embedder, dim: int, index_path: str = None, dict_path: str = None):
        self.embeddings = embeddings
        self.text_dict: Dict[int, Tuple[np.ndarray, str, Dict[str, str]]] = {}

        if index_path and os.path.isdir(index_path):
            # Si pasan una carpeta, guarda los archivos con nombres estándar
            index_path = os.path.join(index_path, "index.faiss")
            dict_path = os.path.join(index_path.replace("index.faiss", "index.pkl"))

        self.index_path = index_path or "index.faiss"
        self.dict_path = dict_path or "index.pkl"

        if os.path.exists(self.index_path):
            self.index = faiss.read_index(self.index_path)
            print(f"Índice cargado desde {self.index_path}")
        else:
            print("No se encontró el archivo de índice, creando nuevo índice.")
            self.index = faiss.IndexFlatL2(dim)


    def get_similar(self, v: np.ndarray, k: int = 5, filter_metadata: Dict[str, str] = None):
        v = np.array([v]).astype("float32")
        D, I = self.index.search(v, k)
        resultados = []

        for idx in I[0]:
            if idx == -1 or idx not in self.text_dict:
                continue

            vector, text = self.text_dict[idx]

            if filter_metadata:
                if not all(text.metadata.dict().get(k) == v for k, v in filter_metadata.items()):
                    continue

            resultados.append((vector, text))

        return resultados


    def add_text(self, v: np.ndarray, t: Text):
        v = np.array([v]).astype("float32")
        self.index.add(v)
        idx = self.index.ntotal - 1
        self.text_dict[idx] = (v, t)  # solo vector y el objeto Text


    def save_index(self):
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)

        faiss.write_index(self.index, self.index_path)
        print(f"Índice guardado en {self.index_path}")

        with open(self.dict_path, "wb") as f:
            pickle.dump(self.text_dict, f)
        print(f"Diccionario guardado en {self.dict_path}")

    def distance(self, v1: np.ndarray, v2: np.ndarray) -> float:
        v1 = np.array([v1]).astype("float32")
        v2 = np.array([v2]).astype("float32")
        return np.linalg.norm(v1 - v2)
