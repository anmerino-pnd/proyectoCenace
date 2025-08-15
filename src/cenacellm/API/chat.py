import os
import shutil
from cenacellm.rag import RAG
from pydantic import BaseModel
from typing import AsyncGenerator, List, Dict, Any, Union, Optional
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from cenacellm.settings.config import VECTORS_DIR, DOCUMENTS_DIR
from fastapi import FastAPI, UploadFile, File, HTTPException, Body # Importa Body
from bson.objectid import ObjectId # Import ObjectId for new conversation IDs

rag = RAG(vectorstore_path=VECTORS_DIR)

class QueryRequest(BaseModel):
    user_id: str
    conversation_id: str # Added conversation_id
    query: str
    k : int = 10
    filter_metadata: dict = None

# Nuevo modelo Pydantic para actualizar los metadatos de un mensaje
class UpdateMetadataRequest(BaseModel):
    new_metadata: Dict[str, Any]

class DeleteSolutionsRequest(BaseModel): # New Pydantic model for deleting solutions
    reference_ids: List[str]

# NUEVO: Modelo Pydantic para eliminar documentos por reference_id
class DeleteDocumentsRequest(BaseModel):
    reference_ids: List[str]

# NUEVO: Modelo Pydantic para eliminar una conversación
class DeleteConversationRequest(BaseModel):
    user_id: str
    conversation_id: str


class AddTicketRequest(BaseModel):
    titulo: str
    descripcion: str
    categories: str

# NUEVO: Modelo Pydantic para actualizar los metadatos de un ticket
# Solo el new_metadata se envía en el body, el ticket_reference viene del path
class UpdateTicketMetadataRequest(BaseModel):
    new_metadata: Dict[str, Any]

# NUEVO: Modelo Pydantic para la creación de nueva conversación con título opcional
class CreateConversationRequest(BaseModel):
    user_id: str
    title: Optional[str] = None # Nuevo campo para el título de la conversación


async def async_chat_stream(request: QueryRequest) -> StreamingResponse:
    """Función asíncrona para manejar el streaming del chat."""
    token_generator = rag.answer(
        request.user_id,
        request.conversation_id, # Pass conversation_id
        request.query,
        k=request.k,
        filter_metadata=request.filter_metadata
    )
    return StreamingResponse(token_generator, media_type="text/event-stream")

def metadata_generator():
    """Generador para obtener metadatos del último chat."""
    # Asegúrate de que `rag.last_chunks` sea accesible y contenga los datos esperados.
    # El formato exacto de los metadatos dependerá de cómo los almacenes en `rag`.
    if hasattr(rag, 'last_chunks') and rag.last_chunks:
        # Extraer solo los metadatos relevantes de cada chunk
        metadata_list = [
            {"reference": chunk.metadata.reference, "metadata": chunk.metadata.model_dump()}
            for chunk in rag.last_chunks if hasattr(chunk, 'metadata') and hasattr(chunk.metadata, 'reference')
        ]
        return {"references": metadata_list}
    return {"references": []}

def get_chat_history(user_id: str, conversation_id: str): # Added conversation_id
    """Obtiene el historial de chat de un usuario y conversación específica."""
    return rag.get_user_history(user_id, conversation_id) # Pass conversation_id

def clear_user_history(user_id: str, conversation_id: str): # Added conversation_id
    """Borra el historial de chat de un usuario y conversación específica."""
    return rag.clear_user_history(user_id, conversation_id) # Pass conversation_id

def load_documents(collection_name: str, force_reload: bool = False):
    """Carga y procesa documentos."""
    docs_count, new_docs_count, chunks_count = rag.load_documents(
        DOCUMENTS_DIR, collection_name, force_reload
    )
    return {
        "docs_count": docs_count,
        "new_docs_count": new_docs_count,
        "chunks_count": chunks_count,
    }

def get_preprocessed_files():
    """Obtiene la lista de archivos preprocesados."""
    return rag.processed_files

async def upload_documents(files: List[UploadFile]):
    """Sube documentos a la carpeta de documentos."""
    uploaded_files_info = []
    for file in files:
        file_location = os.path.join(DOCUMENTS_DIR, file.filename)
        try:
            with open(file_location, "wb+") as file_object:
                shutil.copyfileobj(file.file, file_object)
            uploaded_files_info.append({"filename": file.filename, "size": file.size})
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al subir el archivo {file.filename}: {e}")
    return {"status": "success", "files": uploaded_files_info}

def delete_document(request: DeleteDocumentsRequest): # Ahora espera DeleteDocumentsRequest
    """Elimina documentos del servidor y del vectorstore."""
    deleted_count = 0
    for reference_id in request.reference_ids:
        # Primero eliminar del vectorstore usando la referencia
        rag.delete_from_vectorstore(reference_id)
        # Luego eliminar del registro de archivos procesados (si es un documento)
        # Necesitas buscar el file_key por reference_id si no lo tienes directamente
        # Esto asume que reference_id es único y se puede usar para encontrar el file_key
        # Una forma es iterar o tener un mapeo inverso si la referencia es un UUID de documento
        file_key_to_delete = None
        for key, value in rag.processed_files.items():
            if value.get("reference") == reference_id:
                file_key_to_delete = key
                break
        
        if file_key_to_delete:
            rag._delete_processed_file([file_key_to_delete])
            # Eliminar el archivo físico si es un documento
            file_path = os.path.join(DOCUMENTS_DIR, file_key_to_delete)
            if os.path.exists(file_path):
                os.remove(file_path)
            deleted_count += 1
        else:
            # Si no es un documento (ej. es una solución), solo se elimina del vectorstore
            # y el _delete_processed_file ya no es el método principal para soluciones.
            # La eliminación de soluciones ya se maneja en delete_solution_by_reference
            pass
    rag.refresh_processed_data() # Refresh cache after deletion
    return {"status": "success", "deleted_count": deleted_count}


async def view_document(filename: str):
    """Permite ver un documento PDF."""
    file_path = os.path.join(DOCUMENTS_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    return FileResponse(path=file_path, media_type="application/pdf", filename=filename)

def update_message_metadata(user_id: str, message_id: str, new_metadata: Dict[str, Any]):
    """Actualiza los metadatos de un mensaje específico."""
    updated = rag.assistant.update_message_metadata(user_id, message_id, new_metadata)
    if updated:
        return {"status": "success", "message": "Metadatos del mensaje actualizados."}
    raise HTTPException(status_code=404, detail="Mensaje no encontrado.")

def get_liked_solutions(user_id: str):
    """Obtiene soluciones "likeadas" de un usuario."""
    return rag.assistant.get_liked_solutions(user_id)

def process_liked_solutions_to_vectorstore(user_id: str):
    """Procesa soluciones "likeadas" y las añade al vectorstore."""
    count = rag.add_liked_solutions_to_vectorstore(user_id)
    return {"status": "success", "count": count}

def delete_solution_by_reference(reference_ids: List[str]):
    """Elimina soluciones del vectorstore por su ID de referencia."""
    deleted_count = 0
    for ref_id in reference_ids:
        rag.delete_from_vectorstore(ref_id)
        # También elimina del registro de processed_files_registro si existe
        rag.processed_files_collection.delete_one({"reference": ref_id, "collection": "soluciones"})
        deleted_count += 1
    rag.refresh_processed_data() # Refresh cache
    return {"status": "success", "deleted_count": deleted_count}


def get_user_conversations(user_id: str) -> List[Dict[str, Any]]:
    """Obtiene una lista de las conversaciones de un usuario."""
    return rag.assistant.get_user_conversations(user_id)

def create_new_conversation(request: CreateConversationRequest) -> Dict[str, str]: # Modified signature
    """Crea una nueva conversación y devuelve su ID, con un título opcional."""
    new_conversation_id = str(ObjectId())
    # Pass the title to save_history
    rag.assistant.save_history(request.user_id, new_conversation_id, [], conversation_title=request.title)
    return {"conversation_id": new_conversation_id}

def delete_conversation(user_id: str, conversation_id: str): # New function
    """Elimina una conversación específica para un usuario."""
    rag.delete_conversation(user_id, conversation_id)
    return {"status": "success", "message": f"Conversación {conversation_id} eliminada."}

def get_tickets_list():
    """Obtiene la lista de tickets desde el RAG."""
    return rag.get_tickets()

def add_ticket_to_db(request: AddTicketRequest):
    """Añade un nuevo ticket a la base de datos."""
    return rag.add_ticket(request.titulo, request.descripcion, request.categories)

def update_ticket_metadata_db(ticket_reference: str, new_metadata: Dict[str, Any]): # Actualiza la firma
    """Actualiza los metadatos de un ticket en la base de datos."""
    updated = rag.update_ticket_metadata(ticket_reference, new_metadata)
    if updated:
        return {"status": "success", "message": f"Metadatos del ticket {ticket_reference} actualizados."}
    raise HTTPException(status_code=404, detail="Ticket no encontrado.")
