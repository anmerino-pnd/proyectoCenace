from cenacellm.tools.embedder import Embedder
from cenacellm.clients import openai as api

class OpenAIEmbedder(Embedder):
    def __init__(self):
        self.model = 'text-embedding-3-small'

    def vectorize(self, s):
        return api.embeddings.create(model=self.model, input=[s])