import os
import json
from typing import List, Dict, Any, Generator, Optional, Union, Tuple
from datetime import datetime
from cenacellm.config import VECTORS_DIR, PROCESSED_FILES
from cenacellm.ollama.embedder import OllamaEmbedder
from cenacellm.vectorstore import FAISSVectorStore
from cenacellm.doccollection import DisjointCollection
from cenacellm.ollama.assistant import OllamaAssistant


class RAG:
    def __init__(
        self, 
        vectorstore_path: str = VECTORS_DIR
    ):
        self.vectorstore_path = vectorstore_path
        self.processed_files_path = PROCESSED_FILES
        os.makedirs(vectorstore_path, exist_ok=True)
        
        self.assistant = OllamaAssistant()
        self.collection = DisjointCollection()
        self.embedder = OllamaEmbedder()
        
        self.vectorstore = FAISSVectorStore(
            dim=self.embedder.dim(),
            embeddings=self.embedder,
            folder_path=vectorstore_path
        )
        
        self.processed_files = self._load_processed_files()
        
    
    def _load_processed_files(self) -> Dict[str, Any]:
        if os.path.exists(self.processed_files_path):
            try:
                with open(self.processed_files_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error al cargar registro de archivos procesados: {e}")
                return {}
        return {}
    
    def _save_processed_files(self) -> None:
        with open(self.processed_files_path, 'w', encoding='utf-8') as f:
            json.dump(self.processed_files, f, indent=2, ensure_ascii=False)
    
    def load_documents(self, folder_path: str, 
                       collection_name : str = None,
                       force_reload : bool = False
                       ) -> None:
        if not os.path.exists(folder_path):
            raise FileNotFoundError(f"La carpeta {folder_path} no existe")
        
        docs_count = 0
        new_docs_count = 0
        chunks_count = 0
        
        print(f"Comprobando documentos en {folder_path}...")
        
        for archivo in os.listdir(folder_path):
            if not archivo.endswith(".pdf"):
                continue
                
            ruta_pdf = os.path.join(folder_path, archivo)
            file_stat = os.stat(ruta_pdf)
            last_modified = int(file_stat.st_mtime)
            file_size = file_stat.st_size
            
            file_key = f"{archivo}"
            file_info = self.processed_files.get(file_key, {})
            
            if (not force_reload and file_key in self.processed_files and 
                file_info.get("last_modified") == last_modified and 
                file_info.get("size") == file_size):
                print(f"Omitiendo archivo sin cambios: {archivo}")
                docs_count += 1
                continue
            
            print(f"Procesando nuevo archivo o archivo modificado: {archivo}")
            
            textos = self.collection.load_pdf(ruta_pdf, collection=collection_name)
            chunks = self.collection.get_chunks(textos)
            
            doc_chunks_count = 0
            for chunk in chunks:
                vector = self.embedder.vectorize(chunk.content)
                self.vectorstore.add_text(vector, chunk)
                doc_chunks_count += 1
                chunks_count += 1
            
            self.processed_files[file_key] = {
                "last_modified": last_modified,
                "size": file_size,
                "processed_at": datetime.now().isoformat(),
                "chunks": doc_chunks_count
            }
            
            new_docs_count += 1
            docs_count += 1
        
        if new_docs_count > 0:
            self.vectorstore.save_index()
            self._save_processed_files()
            print(f"Índice vectorial actualizado con {new_docs_count} nuevos documentos.")
        
        print(f"Procesamiento completado. Total: {docs_count} documentos ({new_docs_count} nuevos/modificados), generando {chunks_count} chunks")
    
    def add_document(self, 
                     file_path: str, 
                     collection_name: Optional[str] = None,
                     force_reload: bool = False) -> None:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"El archivo {file_path} no existe")
        
        if not file_path.endswith(".pdf"):
            raise ValueError("Solo se admiten archivos PDF")
        
        archivo = os.path.basename(file_path)
        file_stat = os.stat(file_path)
        last_modified = int(file_stat.st_mtime)
        file_size = file_stat.st_size
        
        file_key = f"{archivo}"
        file_info = self.processed_files.get(file_key, {})
        
        if (not force_reload and file_key in self.processed_files and 
            file_info.get("last_modified") == last_modified and 
            file_info.get("size") == file_size):
            print(f"El documento {archivo} ya está procesado y no ha cambiado.")
            return
        
        print(f"Procesando: {archivo}")
        
        textos = self.collection.load_pdf(file_path, collection=collection_name)
        chunks = self.collection.get_chunks(textos)
        
        chunks_count = 0
        for chunk in chunks:
            vector = self.embedder.vectorize(chunk.content)
            self.vectorstore.add_text(vector, chunk)
            chunks_count += 1
        
        self.processed_files[file_key] = {
            "last_modified": last_modified,
            "size": file_size,
            "processed_at": datetime.now().isoformat(),
            "chunks": chunks_count
        }
        
        self.vectorstore.save_index()
        self._save_processed_files()
        
        print(f"Documento procesado con {chunks_count} chunks generados")
    
    def get_processed_documents(self) -> Dict[str, Any]:
        return self.processed_files
    
    def query(self, 
              user_id: str,
              question: str, 
              k: int = 10,
              filter_metadata: Optional[Dict[str, Any]] = None
             ) ->  Tuple[Generator[str, None, None], List]:
        
        query_vector = self.embedder.vectorize(question)
        
        relevant_chunks = self.vectorstore.get_similar(
            query_vector, 
            k=k,
            filter_metadata=filter_metadata
        )
        
        text_chunks = [chunk[1] for chunk in relevant_chunks]
        
        return self.assistant.answer(question, text_chunks, user_id=user_id), text_chunks

    def answer(self, 
            user_id: str,
            question: str, 
            k: int = 10,
            filter_metadata: Optional[Dict[str, Any]] = None
            ) -> Generator[str, None, None]:
        

        token_generator, text_chunks = self.query(
            user_id, question, k=k, filter_metadata=filter_metadata
        )

        self.last_chunks = text_chunks
        
        for token in token_generator:
            yield token

        
    def get_user_history(self, user_id : str) -> List[Dict[str, Any]]:
        return self.assistant.histories.get(user_id, [])
    
    def clear_user_history(self, user_id) -> None:
        if user_id in self.assistant.histories:
            self.assistant.histories[user_id] = []
            self.assistant.save_history()