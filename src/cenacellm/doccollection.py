from cenacellm.tools.doccollection import DocCollection
from semantic_text_splitter import TextSplitter
from cenacellm.types import TextMetadata, Text
from pypdf import PdfReader
import uuid
from uuid import uuid4
import os

class DisjointCollection(DocCollection):
    def __init__(self):
        self.chunk_size = 1000
        self.max_overlap = 0

    def get_chunks(self, t: Text):
        splitter = TextSplitter(self.chunk_size, self.max_overlap)
        chunks = splitter.chunks(t.content)
        return [Text(content=chunk, metadata=t.metadata) for chunk in chunks]

    def load_pdf(self, pdf_path: str, collection: str = "documentos") -> Text:
        reader = PdfReader(pdf_path)
        content = "\n".join([
            page.extract_text() for page in reader.pages if page.extract_text()
        ])

        # Metadatos básicos
        metadata_dict = {
            "source": pdf_path,
            "reference": str(uuid4()),
            "filename": os.path.basename(pdf_path),
            "collection": collection,
            "total_pages": len(reader.pages),
        }

        # Agregar dinámicamente metadatos del PDF si están disponibles
        doc_info = reader.metadata
        if doc_info:
            for key, value in doc_info.items():
                print(f"{key}: {value}")

            # Añadir dinámicamente los metadatos
            for key, value in doc_info.items():
                clean_key = key.lstrip('/')
                metadata_dict[clean_key.lower()] = str(value) if value is not None else None

        return Text(content=content, metadata=TextMetadata(**metadata_dict))

