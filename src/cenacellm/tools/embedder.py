from abc import ABC, abstractmethod
from cenacellm.types import Vector
from typing import Dict

class Embedder(ABC):
    @abstractmethod
    def vectorize(self, s : str) -> Dict[str, Vector]:
        pass
