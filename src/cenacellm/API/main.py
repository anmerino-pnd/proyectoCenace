from fastapi import FastAPI, UploadFile, File, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from typing import List, Dict, Any
import os
from cenacellm.API.chat import (
    async_chat_stream,
    metadata_generator,
    clear_user_history,
    load_documents,
    QueryRequest,
    UpdateMetadataRequest, # Importa el nuevo modelo de solicitud
    DeleteSolutionsRequest, # Import the new model for deleting solutions
    DeleteDocumentsRequest, # NUEVO: Importa el modelo para eliminar documentos
    DeleteConversationRequest, # NUEVO: Importa el modelo para eliminar conversaciones
    AddTicketRequest, # NUEVO: Importa el modelo para agregar tickets
    UpdateTicketMetadataRequest, # NUEVO: Importa el modelo para actualizar metadatos de tickets
    CreateConversationRequest, # NUEVO: Importa el modelo para crear una conversación
    get_chat_history,
    get_preprocessed_files,
    upload_documents,
    delete_document, # Esta función ahora espera DeleteDocumentsRequest
    view_document,
    update_message_metadata, # Importa la nueva función
    get_liked_solutions, # Importa la nueva función
    process_liked_solutions_to_vectorstore, # Importa la nueva función
    delete_solution_by_reference, # Import the new deletion function
    get_user_conversations, # NUEVO: Importa la función para obtener conversaciones
    create_new_conversation, # NUEVO: Importa la función para crear nueva conversación
    delete_conversation, # NUEVO: Importa la función para eliminar conversación
    get_tickets_list, # Importa la función para obtener la lista de tickets
    add_ticket_to_db, # NUEVO: Importa la función para agregar ticket a DB
    update_ticket_metadata_db # NUEVO: Importa la función para actualizar metadatos de tickets en DB
)

app = FastAPI(root_path="/app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/chat")
async def chat(request: QueryRequest):
    """Endpoint principal para el chat con el modelo."""
    return await async_chat_stream(request)

@app.get("/metadata")
async def metadata():
    """Endpoint para obtener metadatos de la última respuesta del chat."""
    return metadata_generator()

@app.get("/history/{user_id}/{conversation_id}") # Modified route
async def history(user_id: str, conversation_id: str): # Added conversation_id
    """Endpoint para obtener el historial de chat de un usuario y conversación."""
    return get_chat_history(user_id, conversation_id) # Pass conversation_id

@app.delete("/history/{user_id}/{conversation_id}") # Modified route
async def delete_history(user_id: str, conversation_id: str): # Added conversation_id
    """Endpoint para borrar el historial de chat de una conversación específica."""
    clear_user_history(user_id, conversation_id) # Pass conversation_id
    return {"status": "success", "message": "Historial de conversación borrado."}

@app.post("/load_documents")
async def load_docs(collection_name: str, force_reload: bool = False):
    """Endpoint para cargar documentos en el sistema RAG."""
    return load_documents(collection_name, force_reload)

@app.get("/documents")
async def documents():
    """Endpoint para obtener la lista de documentos preprocesados."""
    return get_preprocessed_files()

@app.post("/upload_documents")
async def upload_doc(files: List[UploadFile] = File(...)):
    """Endpoint para subir documentos PDF al servidor."""
    return await upload_documents(files)

# MODIFICADO: Ahora espera el modelo DeleteDocumentsRequest
@app.post("/delete_document")
def delete_doc(request: DeleteDocumentsRequest):
    """Endpoint para eliminar documentos del servidor."""
    return delete_document(request)

@app.get("/view_document/{filename}")
async def view_doc(filename: str):
    """Endpoint para ver documentos PDF en el navegador."""
    return await view_document(filename)

@app.patch("/history/{user_id}/messages/{message_id}")
async def patch_message_metadata(user_id: str, message_id: str, request: UpdateMetadataRequest):
    """
    Endpoint para actualizar los metadatos de un mensaje específico en el historial del usuario.
    Se utiliza para marcar/desmarcar un mensaje como 'liked'.
    """
    return update_message_metadata(user_id, message_id, request.new_metadata)

@app.get("/solutions/{user_id}")
async def solutions(user_id: str):
    """
    Endpoint para obtener una lista de soluciones (mensajes del bot) que han sido marcadas como 'liked'.
    """
    return get_liked_solutions(user_id)

@app.post("/process_liked_solutions/{user_id}")
async def process_liked_solutions(user_id: str):
    """
    Endpoint para procesar las soluciones "likeadas" de un usuario y añadirlas al vectorstore.
    """
    return process_liked_solutions_to_vectorstore(user_id)

@app.post("/delete_solution")
def delete_solution(request: DeleteSolutionsRequest): # New endpoint for deleting solutions
    """
    Endpoint para eliminar soluciones del vectorstore basado en sus reference_ids.
    """
    return delete_solution_by_reference(request.reference_ids)

@app.get("/conversations/{user_id}") # NUEVO endpoint
async def conversations(user_id: str):
    """
    Endpoint para obtener la lista de conversaciones de un usuario.
    """
    return get_user_conversations(user_id)

# Modificado para aceptar un cuerpo con el user_id y el título opcional
@app.post("/new_conversation") # Ruta más genérica, el user_id está en el body ahora
async def new_conversation(request: CreateConversationRequest):
    """
    Endpoint para crear una nueva conversación.
    """
    return create_new_conversation(request)

@app.post("/delete_conversation") # NUEVO endpoint
def delete_conv(request: DeleteConversationRequest):
    """
    Endpoint para eliminar una conversación específica.
    """
    return delete_conversation(request.user_id, request.conversation_id)

@app.get("/tickets")
def tickets_list(): # Renamed function to avoid conflict with imported get_tickets_list
    """
    Endpoint para obtener la lista de tickets.
    """
    return get_tickets_list()

@app.post("/tickets") # NUEVO endpoint para agregar tickets
def add_ticket(request: AddTicketRequest):
    """
    Endpoint para añadir un nuevo ticket a la base de datos.
    """
    return add_ticket_to_db(request)

@app.patch("/tickets/{ticket_reference}") # NUEVO endpoint para actualizar metadatos de tickets
def update_ticket_metadata(ticket_reference: str, new_metadata: Dict[str, Any] = Body(..., embed=True)):
    """
    Endpoint para actualizar los metadatos de un ticket.
    """
    # El `ticket_reference` viene del path. `new_metadata` viene del body.
    # `embed=True` asegura que el JSON body se vea como {"new_metadata": {...}}
    return update_ticket_metadata_db(ticket_reference, new_metadata)


ui_path = os.path.join(os.path.dirname(__file__), "..", "..", "UI")
ui_path = os.path.abspath(ui_path)  # Normaliza la ruta


# Montar CSS, JS, imágenes, etc. (excluye index.html)
app.mount("/static", StaticFiles(directory=ui_path), name="static")

# --- Configurar sistema de plantillas ---
templates = Jinja2Templates(directory=ui_path)

# --- Ruta para servir index.html ---
@app.get("/")
def serve_ui(request: Request):
    # Usa variable de entorno para definir la URL base de tu API
    api_url = os.getenv("API_URL", "")  
    return templates.TemplateResponse("index.html", {
        "request": request,
        "api_url": api_url
    })