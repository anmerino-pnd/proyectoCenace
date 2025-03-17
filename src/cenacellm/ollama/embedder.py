from cenacellm.tools.embedder import Embedder
from cenacellm.clients import ollama as api


class OllamaEmbedder(Embedder):
    def __init__(self):
        self.model = 'jina/jina-embeddings-v2-base-es'

    def vectorize(self, s):
        return api.embeddings(self.model, prompt=s) # Sacarle el vector chilo