document.addEventListener('DOMContentLoaded', () => {
    const apiEndpoint = "http://localhost:8000";
    const messagesContainer = document.getElementById('messages-container');
    const userQueryInput = document.getElementById('userQuery');
    const sendBtn = document.getElementById('sendBtn');
    const deleteHistoryBtn = document.getElementById('deleteHistoryBtn');
    const kValueInput = document.getElementById('k-value');
    const filterMetadataSelect = document.getElementById('filter-metadata');
    const usernameModal = document.getElementById('username-modal');
    const usernameInput = document.getElementById('username-input');
    const submitUsernameBtn = document.getElementById('submit-username-btn');
    const deleteConfirmationModalOverlay = document.getElementById('delete-confirmation-modal-overlay');
    const confirmDeleteBtn = deleteConfirmationModalOverlay.querySelector('.confirm-button');
    const cancelDeleteBtn = deleteConfirmationModalOverlay.querySelector('.cancel-button');

    let userId = localStorage.getItem('cenace_user_id');
    let isBotTyping = false;
    let typingIndicatorElement = null;

    // Función para mostrar/ocultar el modal de nombre de usuario
    function toggleUsernameModal(show) {
        if (show) {
            usernameModal.classList.add('visible');
            usernameInput.focus();
        } else {
            usernameModal.classList.remove('visible');
        }
    }

    // Manejar el envío del nombre de usuario
    submitUsernameBtn.addEventListener('click', () => {
        const enteredUsername = usernameInput.value.trim();
        if (enteredUsername) {
            userId = enteredUsername;
            localStorage.setItem('cenace_user_id', userId);
            toggleUsernameModal(false);
            fetchChatHistory(); // Cargar historial una vez que el usuario esté definido
        } else {
            alert('Por favor, ingresa un nombre de usuario.');
        }
    });

    // Mostrar modal si no hay userId
    if (!userId) {
        toggleUsernameModal(true);
    } else {
        fetchChatHistory(); // Cargar historial si ya hay userId
    }

    // Ajustar la altura del textarea dinámicamente
    userQueryInput.addEventListener('input', () => {
        userQueryInput.style.height = 'auto';
        userQueryInput.style.height = userQueryInput.scrollHeight + 'px';
    });

    // Función para añadir un mensaje al contenedor de mensajes
    function addMessage(role, content, metadata = null) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role);

        // Usar marked.js para renderizar Markdown
        messageDiv.innerHTML = marked.parse(content);

        // Añadir metadatos si existen
        if (metadata && metadata.length > 0) {
            const metadataSection = document.createElement('div');
            metadataSection.classList.add('metadata-section');

            const metadataHeader = document.createElement('div');
            metadataHeader.classList.add('metadata-header');
            metadataHeader.innerHTML = '<h5>Referencias</h5><span class="toggle-icon">&#9660;</span>';
            metadataHeader.style.cursor = 'pointer'; // Make the header clickable
            metadataSection.appendChild(metadataHeader);

            const metadataContent = document.createElement('div');
            metadataContent.classList.add('metadata-content');
            metadataContent.style.display = 'none'; // Hidden by default
            metadataSection.appendChild(metadataContent);

            metadata.forEach((item, index) => {
                const metadataItemDiv = document.createElement('div');
                metadataItemDiv.classList.add('metadata-item');
                let sourceLink = 'N/A';
                if (item.source) {
                    // Extraer solo el nombre del archivo de la ruta completa
                    const sourceFilename = item.source.split(/[\\/]/).pop();
                    // Construir el enlace usando el endpoint /view_document
                    sourceLink = `<a href="${apiEndpoint}/view_document/${encodeURIComponent(sourceFilename)}" target="_blank" class="document-source-link">${sourceFilename}</a>`;
                }

                metadataItemDiv.innerHTML = `
                    <h6>Referencia ${index + 1}</h6>
                    <p><strong>Fuente:</strong> ${sourceLink}</p>
                    <p><strong>Archivo:</strong> ${item.filename || 'N/A'}</p>
                    <p><strong>Página:</strong> ${item.page_number || 'N/A'}</p>
                    <p><strong>Autor:</strong> ${item.author || 'N/A'}</p>
                    <p><strong>Asunto:</strong> ${item.subject || 'N/A'}</p>
                `;
                metadataContent.appendChild(metadataItemDiv);
            });

            // Toggle metadata content on header click
            metadataHeader.addEventListener('click', () => {
                const icon = metadataHeader.querySelector('.toggle-icon');
                if (metadataContent.style.display === 'none') {
                    metadataContent.style.display = 'block';
                    icon.innerHTML = '&#9650;'; // Up arrow
                    icon.classList.add('open');
                } else {
                    metadataContent.style.display = 'none';
                    icon.innerHTML = '&#9660;'; // Down arrow
                    icon.classList.remove('open');
                }
            });

            messageDiv.appendChild(metadataSection);
        }

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll al final
    }

    // Función para mostrar el indicador de escritura
    function showTypingIndicator() {
        if (!isBotTyping) {
            typingIndicatorElement = document.createElement('div');
            typingIndicatorElement.classList.add('typing-indicator');
            typingIndicatorElement.innerHTML = '<span></span><span></span><span></span>';
            messagesContainer.appendChild(typingIndicatorElement);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            isBotTyping = true;
        }
    }

    // Función para ocultar el indicador de escritura
    function hideTypingIndicator() {
        if (isBotTyping && typingIndicatorElement) {
            messagesContainer.removeChild(typingIndicatorElement);
            typingIndicatorElement = null;
            isBotTyping = false;
        }
    }

    // Función para enviar el mensaje
    async function sendMessage() {
        const query = userQueryInput.value.trim();
        const k = parseInt(kValueInput.value);
        const filterMetadata = filterMetadataSelect.value;

        if (!query) return;

        addMessage('user', query);
        userQueryInput.value = '';
        userQueryInput.style.height = 'auto'; // Reset height

        showTypingIndicator();

        try {
            const response = await fetch(`${apiEndpoint}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: userId,
                    query: query,
                    k: k,
                    filter_metadata: filterMetadata !== 'none' ? { collection_name: filterMetadata } : null
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al obtener respuesta del bot.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let botResponseContent = '';
            let metadata = null; // Para almacenar los metadatos al final

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });

                // Detectar el inicio de los metadatos (asumiendo un formato JSON al final)
                const metadataStart = chunk.indexOf('__METADATA_START__');
                if (metadataStart !== -1) {
                    botResponseContent += chunk.substring(0, metadataStart);
                    const metadataJsonString = chunk.substring(metadataStart + '__METADATA_START__'.length);
                    try {
                        metadata = JSON.parse(metadataJsonString);
                    } catch (e) {
                        console.error("Error parsing metadata JSON:", e);
                        // En caso de error, tratar como texto normal o ignorar metadatos
                    }
                } else {
                    botResponseContent += chunk;
                }

                // Actualizar el último mensaje del bot (o crear uno nuevo si es el primero)
                const lastMessage = messagesContainer.lastElementChild;
                if (lastMessage && lastMessage.classList.contains('bot') && !lastMessage.querySelector('.metadata-section')) {
                    lastMessage.innerHTML = marked.parse(botResponseContent);
                } else {
                    if (!lastMessage || !lastMessage.classList.contains('bot')) {
                         addMessage('bot', botResponseContent); // Esto crearía un nuevo div cada vez, no es ideal para streaming
                    }
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            hideTypingIndicator();

            // Una vez que el streaming ha terminado, añadir el mensaje final con metadatos
            // Esto sobrescribirá el último mensaje del bot con la versión completa y metadatos
            messagesContainer.removeChild(messagesContainer.lastElementChild); // Eliminar el mensaje parcial
            addMessage('bot', botResponseContent, metadata);


        } catch (error) {
            hideTypingIndicator();
            console.error("Error sending message:", error);
            addMessage('bot', `Lo siento, ha ocurrido un error: ${error.message}`, null, 'error-message');
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    userQueryInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Cargar historial de chat
    async function fetchChatHistory() {
        if (!userId) return; // No cargar si no hay userId

        messagesContainer.innerHTML = ''; // Limpiar mensajes existentes
        try {
            const response = await fetch(`${apiEndpoint}/history/${userId}`);
            if (!response.ok) {
                throw new Error('Error al cargar el historial del chat.');
            }
            const history = await response.json();
            if (history && history.length > 0) {
                history.forEach(msg => {
                    addMessage(msg.role, msg.content); // Asume que el historial no tiene metadatos complejos aquí
                });
            } else {
                addMessage('bot', '¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?');
            }
        } catch (error) {
            console.error("Error fetching chat history:", error);
            addMessage('bot', `No se pudo cargar el historial: ${error.message}`);
        }
    }

    // Eliminar historial de chat
    deleteHistoryBtn.addEventListener('click', () => {
        deleteConfirmationModalOverlay.classList.add('visible');
    });

    confirmDeleteBtn.addEventListener('click', async () => {
        if (!userId) {
            deleteConfirmationModalOverlay.classList.remove('visible');
            return;
        }
        try {
            const response = await fetch(`${apiEndpoint}/history/${userId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                messagesContainer.innerHTML = '';
                addMessage('bot', '¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?');
            } else {
                const errorData = await response.json();
                alert(`Error al eliminar historial: ${errorData.detail || response.statusText}`);
            }
        } catch (error) {
            console.error("Error deleting chat history:", error);
            alert(`Error de red al eliminar historial: ${error.message}`);
        } finally {
            deleteConfirmationModalOverlay.classList.remove('visible');
        }
    });

    cancelDeleteBtn.addEventListener('click', () => {
        deleteConfirmationModalOverlay.classList.remove('visible');
    });
});
