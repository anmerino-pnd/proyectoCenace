import numpy as np
from cenacellm.tools.embedder import Embedder
from cenacellm.clients import ollama as api


class OllamaEmbedder(Embedder):
    def __init__(self, model = 'bge-m3:latest'):
        self.model = model

    def vectorize(self, s):
            response = api.embeddings(self.model, prompt=s)
            return np.array(response["embedding"], dtype="float32")  # <-- aquí está la clave
        
    
    def dim(self):
        return len(self.vectorize("Hola"))  # <-- aquí está la clave