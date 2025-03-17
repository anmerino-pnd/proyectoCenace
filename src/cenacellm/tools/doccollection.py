from abc import ABC, abstractmethod
from cenacellm.types import Text, Chunks

class DocCollection(ABC):
    @abstractmethod
    def get_chunks(self, t : Text) -> Chunks:
        pass
    
    @abstractmethod
    def load_pdf(self, pdf_path: str) -> Text:
        pass
# ----------------------------------------------------------------------

# class DisjointCollection(DocCollection):
#     def __init__(self, chunk_size):
#         self.chunk_size = chunk_size

#     def get_chunks(self, t : Text) -> Chunks:
#         pass


# class OverlappingCollection(DocCollection):
#     def __init__(self, chunk_size, max_overlap):
#         self.chunk_size = chunk_size
#         self.max_overlap = max_overlap

#     def get_chunks(self, t : Text) -> Chunks:
#         pass


# class RecursiveSplitCollection(DocCollection):
#     def __init__(self, max_chunk_size):
#         self.max_chunk_size = max_chunk_size

#     def get_chunks(self, t : Text) -> Chunks:
#         pass
        
