import numpy as np
from cenacellm.tools.embedder import Embedder
from cenacellm.settings.clients import ollama as api


class OllamaEmbedder(Embedder):
    def __init__(self):
        self.model = 'bge-m3:latest'

    def vectorize(self, s):
            response = api.embeddings(self.model, prompt=s)
            return np.array(response["embedding"], dtype="float32")  # <-- aquí está la clave
        
    def vectorize_batch(self, texts: list[str]) -> list[np.ndarray]:
        """Embed de varios textos en una sola llamada."""
        if not texts:
            return []
        response = api.embeddings(self.model, prompt=texts)
        
        # Ollama devuelve "embeddings" o "embedding" según versión
        vectors = response.get("embedding")
        return [np.array(v, dtype="float32") for v in vectors]
    
    def dim(self):
        return len(self.vectorize("Hola"))  # <-- aquí está la clave