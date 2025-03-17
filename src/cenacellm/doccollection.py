from cenacellm.tools.doccollection import DocCollection
from semantic_text_splitter import TextSplitter
from cenacellm.types import TextMetadata, Text
from pypdf import PdfReader
from uuid import uuid4

class DocCollection(DocCollection):
    def __init__(self):
        self.chunk_size = 1000
        self.max_overlap = 0

    def get_chunks(self, t):
        splitter = TextSplitter(self.chunk_size, self.max_overlap)
        chunks = splitter.chunks(t.content)
        
        return [Text(content=chunk, metadata=t.metadata) for chunk in chunks]

    
    def load_pdf(self, pdf_path):
        reader = PdfReader(pdf_path)
        content = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
        

        metadata = TextMetadata(source=pdf_path, reference=str(uuid4()))  # Pasarle la pagina 
        return Text(content=content, metadata=metadata)