document.addEventListener('DOMContentLoaded', () => {
    const chatArea = document.getElementById('chat-area');
    const chatbox = document.getElementById('messages-container');
    const userQueryTextarea = document.getElementById('userQuery');
    const sendBtn = document.getElementById('sendBtn');
    const sendBtnIconContainer = document.getElementById('sendBtnIcon'); // Obtener el span dentro del botón
    const deleteHistoryBtn = document.getElementById('deleteHistoryBtn');
    const deleteConfirmationModalOverlay = document.getElementById('delete-confirmation-modal-overlay');
    const cancelButton = deleteConfirmationModalOverlay ? deleteConfirmationModalOverlay.querySelector('.cancel-button') : null;
    const confirmButton = deleteConfirmationModalOverlay ? deleteConfirmationModalOverlay.querySelector('.confirm-button') : null;
    const usernameModal = document.getElementById('username-modal');
    const usernameInput = document.getElementById('username-input');
    const submitUsernameBtn = document.getElementById('submit-username-btn');

    const kValueInput = document.getElementById('k-value');
    const filterMetadataSelect = document.getElementById('filter-metadata');

    const apiEndpoint = "http://localhost:8000";
    let userName = '';
    let currentBotMessageElement = null;

    // Variable de estado para gestionar la generación
    let isGeneratingResponse = false;

    // SVG para el icono de enviar (solo necesitamos este ahora)
    const sendIconSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
    `;

    function requestUsername() {
        if (chatArea) chatArea.classList.add('hidden');
        if (usernameModal) {
                usernameModal.classList.add('visible');
                usernameModal.classList.remove('hidden');}
        if (usernameInput) usernameInput.focus();
    }

    function handleSubmitUsername() {
        const enteredUsername = usernameInput.value.trim();
        if (enteredUsername) {
            userName = enteredUsername;
            if (usernameModal) usernameModal.classList.add('hidden');
            if (chatArea) chatArea.classList.remove('hidden');
            loadHistory();
            if (userQueryTextarea) userQueryTextarea.focus();
        } else {
            console.warn("Nombre de usuario vacío."); // O muestra un mensaje en la UI
            if (usernameInput) usernameInput.focus();
        }
    }

    if (submitUsernameBtn) submitUsernameBtn.addEventListener('click', handleSubmitUsername);
    if (usernameInput) usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmitUsername();
        }
    });

    requestUsername();

    // Modificada para asignar un ID único a los mensajes del bot
    function appendMessage(sender, message, isStreaming = false) {
        if (!chatbox) return null;

        if (sender === "bot" && isStreaming && currentBotMessageElement) {
            let rawContent = currentBotMessageElement.dataset.rawContent || '';
            rawContent += message;
            currentBotMessageElement.dataset.rawContent = rawContent;
            if (typeof marked !== "undefined") {
                 currentBotMessageElement.innerHTML = marked.parse(rawContent);
            } else {
                const tempDiv = document.createElement('div');
                tempDiv.textContent = rawContent;
                currentBotMessageElement.innerHTML = tempDiv.innerHTML.replace(/\n/g, '<br>');
            }
            chatbox.scrollTop = chatbox.scrollHeight;
            return currentBotMessageElement;
        } else {
            const msgDiv = document.createElement("div");
            // Asignar un ID único a los mensajes del bot
            if (sender === "bot") {
                msgDiv.id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            }
            msgDiv.classList.add("message", sender);
            if (sender === "bot") {
                currentBotMessageElement = msgDiv;
                msgDiv.dataset.rawContent = message;
                if (typeof marked !== "undefined" && !isStreaming) {
                     msgDiv.innerHTML = marked.parse(message);
                } else {
                     const tempDiv = document.createElement('div');
                     tempDiv.textContent = message;
                     msgDiv.innerHTML = tempDiv.innerHTML.replace(/\n/g, '<br>');
                }
            } else {
                currentBotMessageElement = null;
                const tempDiv = document.createElement('div');
                tempDiv.textContent = message;
                msgDiv.innerHTML = tempDiv.innerHTML.replace(/\n/g, '<br>');
            }
            chatbox.appendChild(msgDiv);
            chatbox.scrollTop = chatbox.scrollHeight;
            return msgDiv;
        }
    }

    function resizeTextarea() {
        if (!userQueryTextarea) return;
        userQueryTextarea.style.height = 'auto';
        userQueryTextarea.style.height = userQueryTextarea.scrollHeight + 'px';
        const maxHeight = 150;
        if (userQueryTextarea.scrollHeight > maxHeight) {
            userQueryTextarea.style.overflowY = 'auto';
            userQueryTextarea.style.height = maxHeight + 'px';
        } else {
            userQueryTextarea.style.overflowY = 'hidden';
        }
    }

    function showSpinner() {
        if (!chatbox) return;
        const existingSpinner = chatbox.querySelector('.typing-indicator');
        if (existingSpinner) return;
        const spinner = document.createElement('div');
        spinner.className = 'typing-indicator';
        spinner.innerHTML = '<span></span><span></span><span></span>';
        chatbox.appendChild(spinner);
        chatbox.scrollTop = chatbox.scrollHeight;
    }

    function hideSpinner() {
        if (!chatbox) return;
        const spinner = chatbox.querySelector('.typing-indicator');
        if (spinner) spinner.remove();
    }

    // Función para habilitar/deshabilitar el input y el botón de enviar
    function toggleInputAndButtonState(enabled) {
        userQueryTextarea.disabled = !enabled;
        sendBtn.disabled = !enabled;

        if (enabled) {
            sendBtn.classList.remove('disabled-btn');
            userQueryTextarea.classList.remove('disabled-input');
            sendBtnIconContainer.innerHTML = sendIconSVG; // Asegurarse de que el icono sea el de enviar
        } else {
            sendBtn.classList.add('disabled-btn');
            userQueryTextarea.classList.add('disabled-input');
            sendBtnIconContainer.innerHTML = sendIconSVG; // El icono se mantiene, pero se ve deshabilitado por el CSS
        }
    }

    async function loadHistory() {
        if (!chatbox || !userName) return;
        chatbox.innerHTML = "";
        const loadingMsg = appendMessage("bot", "Cargando conversación...");
        try {
            const response = await fetch(`${apiEndpoint}/history/${userName}`);
             if (loadingMsg && loadingMsg.parentNode === chatbox) {
                loadingMsg.remove();
            }
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `Error al cargar historial: ${response.status}`;
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.detail) errorMessage += `: ${errorJson.detail}`;
                } catch (e) {
                    errorMessage += `: ${errorText.substring(0, 100)}...`;
                }
                appendMessage("bot", errorMessage);
                return;
            }
            const history = await response.json();
            chatbox.innerHTML = "";
            if (!Array.isArray(history) || history.length === 0) {
                appendMessage("bot", `¡Hola ${userName}! ¿En qué puedo ayudarte hoy?`);
                return;
            }
            // Cargar historial y luego intentar cargar metadatos para cada mensaje del bot
            for (const msg of history) {
                if (msg && typeof msg.role === 'string' && typeof msg.content === 'string') {
                    const sender = msg.role === "user" ? "user" : "bot";
                    const msgElement = appendMessage(sender, msg.content);
                    if (sender === "bot" && msgElement) {
                         // Nota: Cargar metadatos para mensajes históricos puede ser costoso/lento
                         // Considera si realmente necesitas hacer esto o solo para mensajes nuevos
                         // fetchAndDisplayMetadata(msgElement.id);
                    }
                }
            }
            chatbox.scrollTop = chatbox.scrollHeight;
        } catch (error) {
            console.error('Error fetching history:', error);
             if (loadingMsg && loadingMsg.parentNode === chatbox) {
                loadingMsg.remove();
            }
            chatbox.innerHTML = "";
            appendMessage("bot", `¡Hola ${userName}! ¿En qué puedo ayudarte hoy? (Error al conectar con el historial)`);
        }
    }

    function showDeleteConfirmation() {
        if (deleteConfirmationModalOverlay) {
             deleteConfirmationModalOverlay.classList.remove('hidden');
             deleteConfirmationModalOverlay.classList.add('visible');
        } else {
             console.error('showDeleteConfirmation: Elemento modal overlay no encontrado.');
        }
    }

    function hideDeleteConfirmation() {
        if (deleteConfirmationModalOverlay) {
             deleteConfirmationModalOverlay.classList.add('hidden');
             deleteConfirmationModalOverlay.classList.remove('visible');
        } else {
             console.error('hideDeleteConfirmation: Elemento modal overlay no encontrado.');
        }
    }

    async function deleteHistory() {
         if (!userName) {
             hideDeleteConfirmation();
             console.warn("Attempted to delete history without a username.");
             return;
        }
        try {

            const response = await fetch(`${apiEndpoint}/history/${userName}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error ${response.status}:`, errorText);
                 appendMessage("bot", `Error al borrar historial: ${response.status} ${response.statusText}`);
                return;
            }

            if (chatbox) {
                chatbox.innerHTML = '';
                appendMessage("bot", `¡Hola ${userName}! ¿En qué puedo ayudarte hoy?`);
            }
        } catch (error) {
            console.error("Error al borrar historial:", error);
             appendMessage("bot", `Error al borrar historial: ${error.message}`);
        } finally {
            hideDeleteConfirmation();
        }
    }

    function getKValue() {
        if (!kValueInput) return 10;
        const kValue = parseInt(kValueInput.value);
        return isNaN(kValue) ? 10 : kValue;
    }

    function getFilterMetadata() {
        if (!filterMetadataSelect) return {};

        const selectedValue = filterMetadataSelect.value;

        const filterOptions = {
            "documentos": {"collection": "documentos"},
            "articulos": {"collection": "articulos"},
            "noticias": {"collection": "noticias"},
            "todos": {}
        };

        return filterOptions[selectedValue] || {};
    }

    // Nueva función para obtener y mostrar metadatos de forma colapsable
    async function fetchAndDisplayMetadata(messageElementId) {
        try {
            const response = await fetch(`${apiEndpoint}/metadata`);
            if (!response.ok) {
                console.error(`Error fetching metadata: ${response.status}`);
                return;
            }
            const metadataArray = await response.json(); // Esperamos un array

            const messageElement = document.getElementById(messageElementId);

            if (messageElement && Array.isArray(metadataArray) && metadataArray.length > 0) {
                const metadataSection = document.createElement('div');
                metadataSection.classList.add('metadata-section');

                const metadataHeader = document.createElement('div');
                metadataHeader.classList.add('metadata-header');
                metadataHeader.innerHTML = '<h5>Referencias <span class="toggle-icon">+</span></h5>'; // Título y icono

                const metadataDetails = document.createElement('div');
                metadataDetails.classList.add('metadata-details', 'hidden'); // Inicialmente oculto

                // Iterar sobre el array de objetos de metadatos
                metadataArray.forEach((item, index) => {
                    if (item.metadata.collection === 'documentos') { // Verificar si el objeto tiene la clave 'metadata'
                        const metadataItemDiv = document.createElement('div');
                        metadataItemDiv.classList.add('metadata-item');

                        const itemTitle = document.createElement('h6');
                        // Usar el título si existe, o un identificador genérico
                        itemTitle.textContent = `Referencia ${index + 1}${item.metadata.title ? ': ' + item.metadata.title : ''}`;
                        metadataItemDiv.appendChild(itemTitle);

                        const detailsList = document.createElement('ul');
                        // Mostrar solo algunos campos relevantes, ajusta según necesites
                        const fieldsToShow = [
                            //'source',
                            //'filename',
                            'page_number', 'author', 'subject'];
                        if (item.metadata["filename"]) {
                            const viewDocumentUrl = `${apiEndpoint}/view_document/${encodeURIComponent(item.metadata.filename)}`;;
                            const sourceItem = document.createElement('a');
                            sourceItem.href = viewDocumentUrl;
                            sourceItem.textContent = 'Abrir documento';
                            sourceItem.target = "_blank"; // Abrir en nueva pestaña
                            detailsList.appendChild(sourceItem);
                        }
                        fieldsToShow.forEach(field => {
                            if (item.metadata[field]) {
                                const listItem = document.createElement('li');
                                listItem.textContent = `${field.replace('_', ' ')}: ${item.metadata[field]}`;
                                detailsList.appendChild(listItem);
                            }
                        });


                        metadataItemDiv.appendChild(detailsList);
                        metadataDetails.appendChild(metadataItemDiv);
                    }
                });

                metadataSection.appendChild(metadataHeader);
                metadataSection.appendChild(metadataDetails);
                messageElement.appendChild(metadataSection);
                chatbox.scrollTop = chatbox.scrollHeight; // Desplazar para ver la nueva sección

                // Añadir evento para colapsar/expandir
                metadataHeader.addEventListener('click', () => {
                    metadataDetails.classList.toggle('hidden');
                    const icon = metadataHeader.querySelector('.toggle-icon');
                    if (metadataDetails.classList.contains('hidden')) {
                        icon.textContent = '+';
                    } else {
                        icon.textContent = '-';
                    }
                });
            }

        } catch (error) {
            console.error("Error fetching or displaying metadata:", error);
             // Opcional: Mostrar un mensaje de error en la UI si falla la carga de metadatos
        }
    }


    async function sendMessage() {
        if (!userQueryTextarea || !userQueryTextarea.value.trim() || !userName) {
             if (!userName) console.warn("Intento de enviar mensaje sin nombre de usuario."); // O muestra un mensaje en la UI
             return;
        }

        // Si ya se está generando una respuesta, no permitir enviar un nuevo mensaje
        if (isGeneratingResponse) {
            console.warn("Ya se está generando una respuesta. Por favor, espera.");
            return;
        }

        isGeneratingResponse = true; // Iniciar generación
        toggleInputAndButtonState(false); // Deshabilitar input y botón

        const userQuery = userQueryTextarea.value.trim();
        appendMessage("user", userQuery);
        userQueryTextarea.value = "";
        resizeTextarea();
        userQueryTextarea.focus(); // Mantener el foco en el textarea

        showSpinner(); // Mostrar spinner
        currentBotMessageElement = null; // Reset antes de la nueva respuesta

        const kValue = getKValue();
        const filterMetadata = getFilterMetadata();

        let latestBotMessageId = null; // Variable para guardar el ID del último mensaje del bot

        try {
            const response = await fetch(`${apiEndpoint}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
                body: JSON.stringify({
                     user_id: userName,
                     query: userQuery,
                     k: kValue,
                     filter_metadata: filterMetadata
                })
            });

            if (!response.ok || !response.body) {
                hideSpinner();
                const errorText = await response.text();
                let errorMessage = `Error: ${response.status}`;
                 try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.detail) errorMessage += `: ${errorJson.detail}`;
                } catch (e) {
                     errorMessage += `: ${errorText.substring(0,100)}...`;
                }
                appendMessage("bot", errorMessage);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let firstChunk = true;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunkValue = decoder.decode(value, { stream: true });
                if (firstChunk) {
                    hideSpinner(); // Ocultar spinner después del primer chunk
                    // Capturar el elemento del mensaje del bot la primera vez
                    const msgElement = appendMessage("bot", chunkValue, false);
                    if (msgElement) {
                         latestBotMessageId = msgElement.id; // Guardar su ID
                    }
                    firstChunk = false;
                } else {
                    appendMessage("bot", chunkValue, true);
                    // currentBotMessageElement ya apunta al último, no necesitamos su ID aquí
                }
            }
        } catch (error) {
            console.error("Fetch or streaming error:", error);
            appendMessage("bot", "Hubo un problema al enviar el mensaje. Intenta nuevamente.");
        } finally {
            isGeneratingResponse = false; // Finalizar generación
            toggleInputAndButtonState(true); // Re-habilitar input y botón

             // Asegurarse de que el contenido Markdown se renderice después de que termine el streaming
             if (currentBotMessageElement && typeof marked !== "undefined" && currentBotMessageElement.dataset.rawContent) {
                 currentBotMessageElement.innerHTML = marked.parse(currentBotMessageElement.dataset.rawContent);
             }

            chatbox.scrollTop = chatbox.scrollHeight;

            // Llamar a la función para obtener y mostrar metadatos después de la respuesta principal
            if (latestBotMessageId) {
                 fetchAndDisplayMetadata(latestBotMessageId);
            } else if (currentBotMessageElement && currentBotMessageElement.id) {
                 // En caso de que no se haya capturado el ID en el primer chunk (aunque appendMessage lo asigna)
                 fetchAndDisplayMetadata(currentBotMessageElement.id);
            }

             // Ahora sí, resetear currentBotMessageElement para el próximo mensaje
             currentBotMessageElement = null;
        }
    }

    // Modificar el listener de eventos del botón de enviar
    if (sendBtn && userQueryTextarea) {
        sendBtn.addEventListener('click', sendMessage);
        userQueryTextarea.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // Prevenir el comportamiento por defecto de Enter (nueva línea)
                if (!isGeneratingResponse) { // Solo enviar mensaje si no se está generando una respuesta
                    sendMessage();
                } else {
                    // Opcional: Proporcionar retroalimentación de que la generación está en curso
                    console.log("No se puede enviar un nuevo mensaje mientras se genera una respuesta.");
                }
            }
        });
        userQueryTextarea.addEventListener('input', resizeTextarea);
        resizeTextarea();
    }
    if (deleteHistoryBtn) deleteHistoryBtn.addEventListener('click', showDeleteConfirmation);
    if (cancelButton) cancelButton.addEventListener('click', hideDeleteConfirmation);
    if (confirmButton) confirmButton.addEventListener('click', deleteHistory);
    if (userQueryTextarea) userQueryTextarea.focus();
});
