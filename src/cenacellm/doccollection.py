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
        content = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])

        # Extraer metadatos básicos
        metadata_dict = {
            "source": pdf_path,
            "reference": str(uuid4()),
            "filename": os.path.basename(pdf_path),
            "collection": collection,
            "total_pages": len(reader.pages),
        }

        # Agregar metadatos del documento si existen
        doc_info = reader.metadata
        if doc_info:
            metadata_dict.update({
                "author": getattr(doc_info, "author", None),
                "creator": getattr(doc_info, "creator", None),
                "producer": getattr(doc_info, "producer", None),
                "title": getattr(doc_info, "title", None),
                "subject": getattr(doc_info, "subject", None),
                "creation_date": getattr(doc_info, "creation_date", None),
                "modification_date": getattr(doc_info, "modification_date", None),
            })

        # Crear y retornar el objeto Text con su metadata
        return Text(content=content, metadata=TextMetadata(**metadata_dict))

