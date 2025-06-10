from cenacellm.tools.doccollection import DocCollection
from semantic_text_splitter import TextSplitter
from cenacellm.types import TextMetadata, Text
from typing import List, Union
from uuid import uuid4
from PyPDF2 import PdfReader
import os
from cenacellm.types import Text, TextMetadata
import uuid
from uuid import uuid4
import os

class DisjointCollection(DocCollection):
    def __init__(self):
        self.chunk_size = 1500
        self.max_overlap = 200

    def get_chunks(self, texts: Union[Text, List[Text]]):
        splitter = TextSplitter(self.chunk_size, self.max_overlap)
        if isinstance(texts, Text):
            texts = [texts]

        all_chunks = []
        for t in texts:
            chunks = splitter.chunks(t.content)
            all_chunks.extend([Text(content=chunk, metadata=t.metadata) for chunk in chunks])
        return all_chunks



    def load_pdf(self, pdf_path: str, collection: str = None) -> List[Text]:
        reader = PdfReader(pdf_path)
        texts: List[Text] = []
        total_pages = len(reader.pages)
        filename = os.path.basename(pdf_path)
        reference_id = str(uuid4())

        # Obtener metadatos del PDF si están disponibles
        doc_info = reader.metadata
        extra_metadata = {}
        if doc_info:
            for key, value in doc_info.items():
                clean_key = key.lstrip('/')
                extra_metadata[clean_key.lower()] = str(value) if value is not None else None

        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if not page_text:
                continue

            metadata_dict = {
                "source": pdf_path,
                "reference": reference_id,
                "filename": filename,
                "collection": collection,
                "total_pages": total_pages,
                "page_number": i + 1, 
                **extra_metadata
            }

            text = Text(content=page_text, metadata=TextMetadata(**metadata_dict))
            texts.append(text)

        return texts


