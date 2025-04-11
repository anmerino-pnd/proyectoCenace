from abc import ABC, abstractmethod
from cenacellm.types import Text, Vector
from typing import List, Tuple

class VectorStore(ABC):
    @abstractmethod
    def get_similar(self, v : Vector) -> List[Tuple[Vector, Text]]:
        pass

    @abstractmethod
    def add_text(self, v : Vector, t : Text) -> bool:
        pass

  
    def del_text(self, v : Vector) -> bool:
        pass

    @abstractmethod
    def distance(self, v1 : Vector, v2 : Vector) -> float:
        pass
