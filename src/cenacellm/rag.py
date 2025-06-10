import os
import json
from typing import List, Dict, Any, Generator, Optional, Union, Tuple
from datetime import datetime
from cenacellm.config import VECTORS_DIR, PROCESSED_FILES
from cenacellm.ollama.embedder import OllamaEmbedder
from cenacellm.vectorstore import FAISSVectorStore
from cenacellm.doccollection import DisjointCollection
from cenacellm.ollama.assistant import OllamaAssistant
from cenacellm.types import Text, TextMetadata # Import Text and TextMetadata

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
        
        self.client = self.assistant.client 
        self.db = self.client[self.assistant.db_name] 
        self.processed_files_collection = self.db["processed_files_registro"]  
        self.processed_files_collection.create_index("file_key", unique=True)
        
        # Nueva colección para registrar soluciones "likeadas" procesadas
        self.processed_solutions_collection = self.db["processed_solutions_registro"]
        self.processed_solutions_collection.create_index("reference", unique=True)

        self.processed_files : dict = self._load_processed_files()
        self.processed_solutions_ids : set = self._load_processed_solutions_ids()


    def _load_processed_files(self) -> Dict[str, Any]:
        """Carga los archivos procesados desde la base de datos."""
        processed_files_dict = {}
        for doc in self.processed_files_collection.find():
            file_key = doc.get("file_key")
            if file_key:
                doc.pop("_id", None)
                processed_files_dict[file_key] = doc
        return processed_files_dict
    
    def _save_processed_files(self) -> None:
        """Guarda los archivos procesados en la base de datos."""
        for file_key, file_info in self.processed_files.items():
            document_to_save = {"file_key": file_key, **file_info}
            self.processed_files_collection.update_one(
                {"file_key": file_key},
                {"$set": document_to_save},
                upsert=True 
            )
    
    def _delete_processed_file(self, file_key: List[str]) -> None:
        """Elimina archivos procesados de la base de datos."""
        for file_name in file_key:
            self.processed_files_collection.delete_one({"file_key": file_name})
            if file_name in self.processed_files:
                del self.processed_files[file_name]
    
    def _load_processed_solutions_ids(self) -> set:
        """Carga los IDs de las soluciones "likeadas" ya procesadas desde la base de datos."""
        return {doc["reference"] for doc in self.processed_solutions_collection.find({}, {"reference": 1})}

    def _add_processed_solution_id(self, message_id: str) -> None:
        """Añade el ID de una solución procesada al registro."""
        self.processed_solutions_collection.update_one(
            {"reference": message_id},
            {"$set": {"reference": message_id, "processed_at": datetime.now().isoformat()}},
            upsert=True
        )
        self.processed_solutions_ids.add(message_id) # Actualiza el conjunto en memoria

    def load_documents(self, folder_path: str, 
                       collection_name : str = None,
                       force_reload : bool = False
                       ) -> list:
        """Carga documentos PDF de una carpeta al vectorstore."""
        if not os.path.exists(folder_path):
            raise FileNotFoundError(f"La carpeta {folder_path} no existe")
        
        docs_count = 0
        new_docs_count = 0
        chunks_count = 0
        
        
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
                file_info.get("size") == file_size):
                docs_count += 1
                continue
                        
            textos = self.collection.load_pdf(ruta_pdf, collection=collection_name)
            chunks = self.collection.get_chunks(textos)
            
            doc_chunks_count = 0
            for chunk in chunks:
                vector = self.embedder.vectorize(chunk.content)
                self.vectorstore.add_text(vector, chunk)
                doc_chunks_count += 1
                chunks_count += 1
            
            self.processed_files[file_key] = {
                "source": ruta_pdf,
                "last_modified": last_modified,
                "size": file_size,
                "processed_at": datetime.now().isoformat(),
                "chunks": doc_chunks_count,
                "reference": textos[0].metadata.reference if textos else None,
            }
            
            new_docs_count += 1
            docs_count += 1
        
        if new_docs_count > 0:
            self.vectorstore.save_index()
            self._save_processed_files()
        
        return [docs_count, new_docs_count, chunks_count]
    
    
    def query(self, 
              user_id: str,
              question: str, 
              k: int = 10,
              filter_metadata: Optional[Dict[str, Any]] = None
             ) -> Tuple[Generator[str, None, None], List, str, Dict[str, Any]]: # Updated return type hint

        query_vector = self.embedder.vectorize(question)

        relevant_chunks = self.vectorstore.get_similar(
            query_vector, 
            k=k,
            filter_metadata=filter_metadata
        )
        
        text_chunks = [chunk[1] for chunk in relevant_chunks]

        # Call assistant.answer and unpack the new return values
        token_generator, bot_message_id, full_metadata = self.assistant.answer(question, text_chunks, user_id=user_id)

        return token_generator, text_chunks, bot_message_id, full_metadata

    def answer(self, 
            user_id: str,
            question: str, 
            k: int = 10,
            filter_metadata: Optional[Dict[str, Any]] = None
            ) -> Generator[Union[str, Dict[str, Any]], None, None]: # Updated return type hint

        token_generator, text_chunks, bot_message_id, full_metadata = self.query(
            user_id, question, k=k, filter_metadata=filter_metadata
        )

        self.last_chunks = text_chunks # This will now contain the chunks used for the answer
        
        for token in token_generator:
            yield token

        # After all tokens are yielded, send the final message ID and metadata
        yield {"reference": bot_message_id, "metadata": full_metadata}

        
    def get_user_history(self, user_id : str) -> List[Dict[str, Any]]:
        return self.assistant.load_history(user_id)
    
    def clear_user_history(self, user_id) -> None:
        return self.assistant.clear_user_history(user_id)

    def add_liked_solutions_to_vectorstore(self, user_id: str) -> int:
        """
        Recupera soluciones marcadas como 'liked' de un usuario y las añade al vectorstore.
        Solo añade las soluciones que no han sido procesadas previamente.
        El contenido será la pregunta y respuesta, y los metadatos incluirán información relevante
        de la solución y sus referencias originales.
        """
        liked_solutions = self.assistant.get_liked_solutions(user_id)
        solutions_added_count = 0

        for solution in liked_solutions:
            message_id = solution["id"]
            
            # Verificar si la solución ya ha sido procesada
            if message_id in self.processed_solutions_ids:
                continue # Saltar esta solución si ya está procesada

            # Combinar pregunta y respuesta como contenido para el vector
            content = f"Pregunta: {solution['question']}\nRespuesta: {solution['answer']}"

            # Extraer metadatos relevantes de la solución original
            original_call_metadata = solution['metadata']
            
            # Construir los metadatos para el objeto Text a almacenar en el vectorstore
            new_text_metadata_dict = {
                "source": "liked_solution",
                "reference": message_id, 
                "collection": "soluciones", 
                "user_id": user_id,
                "disable": original_call_metadata.get("disable", False), # Debería ser True para liked solutions
                "timestamp": original_call_metadata.get("timestamp"),
            }

            # Procesar las referencias originales y extraer solo la metadata relevante
            extracted_references_metadata = []
            for ref in original_call_metadata.get("references", []):
                ref_metadata = ref.get("metadata", {})
                extracted_ref = {}
                if "source" in ref_metadata: extracted_ref["source"] = ref_metadata["source"]
                if "filename" in ref_metadata: extracted_ref["filename"] = ref_metadata["filename"]
                if "page_number" in ref_metadata: extracted_ref["page_number"] = ref_metadata["page_number"]
                if "title" in ref_metadata: extracted_ref["title"] = ref_metadata["title"]
                if extracted_ref: # Solo añadir si tiene campos relevantes
                    extracted_references_metadata.append(extracted_ref)
            
            if extracted_references_metadata:
                new_text_metadata_dict["metadata"] = extracted_references_metadata

            # Crear el objeto Text con el contenido y los metadatos construidos
            text_obj = Text(content=content, metadata=TextMetadata(**new_text_metadata_dict))

            # Vectorizar el contenido y añadirlo al vectorstore
            vector = self.embedder.vectorize(content)
            self.vectorstore.add_text(vector, text_obj)
            self._add_processed_solution_id(message_id) # Registrar como procesada
            solutions_added_count += 1
        
        if solutions_added_count > 0:
            self.vectorstore.save_index()
        else:
            pass
        return solutions_added_count

    def delete_from_vectorstore(self, reference_id):
        """
        Elimina un documento del vectorstore basado en su referencia.
        """
        self.vectorstore.delete_by_reference(reference_id)


