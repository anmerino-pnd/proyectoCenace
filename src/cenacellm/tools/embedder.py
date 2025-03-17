from abc import ABC, abstractmethod
from cenacellm.types import Vector

class Embedder(ABC):
    @abstractmethod
    def vectorize(self, s : str) -> Vector:
        pass
