document.addEventListener('DOMContentLoaded', () => {
    const chatArea = document.getElementById('chat-area');
    const chatbox = document.getElementById('messages-container');
    const userQueryTextarea = document.getElementById('userQuery');
    const sendBtn = document.getElementById('sendBtn');
    const sendBtnIconContainer = document.getElementById('sendBtnIcon');
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

    let isGeneratingResponse = false;

    const sendIconSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
    `;

    const likeIconSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-heart">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
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
            console.warn("Nombre de usuario vacío.");
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

    /**
     * Añade un mensaje al contenedor de chat.
     * @param {string} sender - El remitente del mensaje ('user' o 'bot').
     * @param {string} message - El contenido del mensaje.
     * @param {boolean} isStreaming - Si el mensaje está siendo transmitido (streaming).
     * @param {string|null} messageId - El ID único del mensaje (solo para mensajes del bot).
     * @param {object} metadata - Los metadatos asociados al mensaje (solo para mensajes del bot).
     * @returns {HTMLElement|null} El elemento del mensaje HTML creado.
     */
    function appendMessage(sender, message, isStreaming = false, messageId = null, metadata = {}) {
        if (!chatbox) return null;

        // Si es un mensaje de bot en streaming y ya tenemos un elemento actual, actualízalo
        if (sender === "bot" && isStreaming && currentBotMessageElement) {
            let rawContent = currentBotMessageElement.dataset.rawContent || '';
            rawContent += message;
            currentBotMessageElement.dataset.rawContent = rawContent;
            // Durante el streaming, solo actualizamos el texto plano para evitar parseos incompletos
            currentBotMessageElement.textContent = rawContent; // Usar textContent para evitar problemas de HTML/Markdown parcial
            
            // Asegúrate de que el icono de "like" permanezca al final
            const likeIcon = currentBotMessageElement.querySelector('.like-icon');
            if (likeIcon) {
                currentBotMessageElement.appendChild(likeIcon);
            }
            chatbox.scrollTop = chatbox.scrollHeight;
            return currentBotMessageElement;
        } else {
            // Crea un nuevo elemento de mensaje
            const msgDiv = document.createElement("div");
            if (sender === "bot") {
                // Asigna un ID único al mensaje del bot si no se proporciona uno
                msgDiv.id = messageId || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                msgDiv.dataset.messageId = msgDiv.id; // Almacena el ID para fácil acceso
            }
            msgDiv.classList.add("message", sender);

            if (sender === "bot") {
                currentBotMessageElement = msgDiv;
                msgDiv.dataset.rawContent = message; // Almacena el contenido crudo para streaming
                // Inicialmente, solo muestra el texto plano
                msgDiv.textContent = message;

                // Añade el icono de "like" a los mensajes del bot
                const likeIcon = document.createElement('span');
                likeIcon.classList.add('like-icon');
                likeIcon.innerHTML = likeIconSVG;
                likeIcon.dataset.messageId = msgDiv.id; // Enlaza el icono con el ID del mensaje
                // Si el mensaje ya está "likeado" en los metadatos, añade la clase 'liked'
                if (metadata && metadata.disable === true) {
                    likeIcon.classList.add('liked');
                }
                msgDiv.appendChild(likeIcon);

            } else {
                currentBotMessageElement = null; // Resetea para mensajes de usuario
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

    function toggleInputAndButtonState(enabled) {
        userQueryTextarea.disabled = !enabled;
        sendBtn.disabled = !enabled;

        if (enabled) {
            sendBtn.classList.remove('disabled-btn');
            userQueryTextarea.classList.remove('disabled-input');
            sendBtnIconContainer.innerHTML = sendIconSVG;
        } else {
            sendBtn.classList.add('disabled-btn');
            userQueryTextarea.classList.add('disabled-input');
            sendBtnIconContainer.innerHTML = sendIconSVG;
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
            for (const msg of history) {
                if (msg && typeof msg.role === 'string' && typeof msg.content === 'string') {
                    const sender = msg.role === "user" ? "user" : "bot";
                    // Pasa el ID del mensaje y los metadatos para los mensajes del bot al cargar el historial
                    const msgElement = appendMessage(sender, msg.content, false, msg.id, msg.metadata);
                    // Después de cargar el mensaje, si es un bot y tiene metadatos, mostrarlos
                    if (sender === "bot" && msgElement) {
                        // Renderizar Markdown después de que el mensaje esté en el DOM
                        if (typeof marked !== "undefined") {
                            msgElement.innerHTML = marked.parse(msg.content);
                        } else {
                            // Fallback para texto plano si 'marked' no está disponible
                            const tempDiv = document.createElement('div');
                            tempDiv.textContent = msg.content;
                            msgElement.innerHTML = tempDiv.innerHTML.replace(/\n/g, '<br>');
                        }
                        // Re-añadir el icono de like después de parsear Markdown
                        const likeIcon = document.createElement('span');
                        likeIcon.classList.add('like-icon');
                        likeIcon.innerHTML = likeIconSVG;
                        likeIcon.dataset.messageId = msg.id;
                        if (msg.metadata && msg.metadata.disable === true) {
                            likeIcon.classList.add('liked');
                        }
                        msgElement.appendChild(likeIcon);

                        if (msg.metadata && msg.metadata.references) {
                            fetchAndDisplayMetadata(msgElement, msg.metadata.references);
                        }
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
            "None": {}
        };

        return filterOptions[selectedValue] || {};
    }

    /**
     * Muestra la sección de metadatos/referencias para un mensaje del bot.
     * @param {HTMLElement} messageElement - El elemento div del mensaje del bot.
     * @param {Array<Object>} metadataArray - El array de objetos de metadatos/referencias.
     */
    function fetchAndDisplayMetadata(messageElement, metadataArray) {
        if (!messageElement || !Array.isArray(metadataArray) || metadataArray.length === 0) {
            return;
        }

        // Eliminar cualquier sección de metadatos existente para evitar duplicados
        const existingMetadataSection = messageElement.querySelector('.metadata-section');
        if (existingMetadataSection) {
            existingMetadataSection.remove();
        }

        const metadataSection = document.createElement('div');
        metadataSection.classList.add('metadata-section');

        const metadataHeader = document.createElement('div');
        metadataHeader.classList.add('metadata-header');
        metadataHeader.innerHTML = '<h5>Referencias <span class="toggle-icon">+</span></h5>';

        const metadataDetails = document.createElement('div');
        metadataDetails.classList.add('metadata-details', 'hidden');

        metadataArray.forEach((item, index) => {
            if (item.metadata.collection === 'documentos') {
                const metadataItemDiv = document.createElement('div');
                metadataItemDiv.classList.add('metadata-item');

                const itemTitle = document.createElement('h6');
                itemTitle.textContent = `Referencia ${index + 1}${item.metadata.title ? ': ' + item.metadata.title : ''}`;
                metadataItemDiv.appendChild(itemTitle);

                const detailsList = document.createElement('ul');
                const fieldsToShow = [
                    'page_number', 'author', 'subject'];
                if (item.metadata["filename"]) {
                    const viewDocumentUrl = `${apiEndpoint}/view_document/${encodeURIComponent(item.metadata.filename)}`;;
                    const sourceItem = document.createElement('a');
                    sourceItem.href = viewDocumentUrl;
                    sourceItem.textContent = 'Abrir documento';
                    sourceItem.target = "_blank";
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
        chatbox.scrollTop = chatbox.scrollHeight;

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

    /**
     * Alterna el estado de "me gusta" de un mensaje y actualiza el backend.
     * @param {string} messageId - El ID del mensaje a actualizar.
     * @param {boolean} isLiked - El nuevo estado de "me gusta" (true para "likeado", false para "no likeado).
     * @param {function} callback - Función a ejecutar después de la actualización exitosa.
     */
    async function toggleLike(messageId, isLiked, callback) {
        if (!userName) {
            console.warn("No hay nombre de usuario disponible para dar/quitar 'me gusta' al mensaje.");
            return;
        }
        try {
            const response = await fetch(`${apiEndpoint}/history/${userName}/messages/${messageId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_metadata: { disable: isLiked } })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error al actualizar los metadatos del mensaje: ${response.status}`, errorText);
            } else {
                if (callback && typeof callback === 'function') {
                    callback(); 
                }
            }
        } catch (error) {
            console.error("Error al alternar el estado de 'me gusta':", error);
        }
    }

    // Delegación de eventos para los iconos de "like"
    if (chatbox) {
        chatbox.addEventListener('click', (event) => {
            const likeIcon = event.target.closest('.like-icon');
            if (likeIcon) {
                const messageId = likeIcon.dataset.messageId;
                const isCurrentlyLiked = likeIcon.classList.contains('liked');
                likeIcon.classList.toggle('liked', !isCurrentlyLiked); // Actualización optimista de la UI
                // Pasa una función de callback para recargar soluciones si la pestaña está activa
                toggleLike(messageId, !isCurrentlyLiked, () => {
                    const solutionsTabButton = document.querySelector('.tab-button[data-tab="soluciones"]');
                    if (solutionsTabButton && solutionsTabButton.classList.contains('active')) {
                        // Llama a la función global para cargar soluciones definida en soluciones.js
                        if (typeof window.loadLikedSolutions === 'function') {
                            window.loadLikedSolutions(userName, apiEndpoint);
                        }
                    }
                });
            }
        });
    }

    async function sendMessage() {
        if (!userQueryTextarea || !userQueryTextarea.value.trim() || !userName) {
             if (!userName) console.warn("Intento de enviar mensaje sin nombre de usuario.");
             return;
        }

        if (isGeneratingResponse) {
            console.warn("Ya se está generando una respuesta. Por favor, espera.");
            return;
        }

        isGeneratingResponse = true;
        toggleInputAndButtonState(false);

        const userQuery = userQueryTextarea.value.trim();
        appendMessage("user", userQuery);
        userQueryTextarea.value = "";
        resizeTextarea();
        userQueryTextarea.focus();

        showSpinner();
        currentBotMessageElement = null; // Reset currentBotMessageElement before new message

        const kValue = getKValue();
        const filterMetadata = getFilterMetadata();

        let latestBotMessageId = null;
        let finalMetadata = {}; // To store the metadata received at the end of the stream
        let accumulatedText = ""; // To accumulate text content for Markdown parsing

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
            let botMessageElement = null; // Reference to the bot message element

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunkValue = decoder.decode(value, { stream: true });

                try {
                    // Attempt to parse the entire chunk as JSON.
                    // This is for the final metadata object that comes as a complete JSON string.
                    const parsedChunk = JSON.parse(chunkValue);
                    if (parsedChunk.message_id && parsedChunk.metadata) {
                        latestBotMessageId = parsedChunk.message_id;
                        finalMetadata = parsedChunk.metadata;
                        // If it's the final metadata, we don't append it as text.
                        // We break the loop here because the text streaming is done.
                        break;
                    }
                } catch (e) {
                    // If parsing fails, it's a text chunk.
                    accumulatedText += chunkValue;
                    if (firstChunk) {
                        hideSpinner();
                        // Create the message element with a temporary ID if no real ID yet
                        botMessageElement = appendMessage("bot", accumulatedText, false, latestBotMessageId, finalMetadata);
                        firstChunk = false;
                    } else {
                        // Update the existing message element with new text
                        appendMessage("bot", chunkValue, true);
                    }
                }
            }

            // After streaming, ensure the final message ID is set and metadata is displayed
            if (botMessageElement) {
                // Update the element's ID with the real ID from the backend
                if (latestBotMessageId && botMessageElement.id !== latestBotMessageId) {
                    botMessageElement.id = latestBotMessageId;
                    botMessageElement.dataset.messageId = latestBotMessageId;

                    // Update the like icon's dataset.messageId as well
                    const likeIcon = botMessageElement.querySelector('.like-icon');
                    if (likeIcon) {
                        likeIcon.dataset.messageId = latestBotMessageId;
                    }
                }

                // Render the final Markdown content
                if (typeof marked !== "undefined" && accumulatedText) {
                    botMessageElement.innerHTML = marked.parse(accumulatedText);
                } else {
                    // Fallback for plain text
                    const tempDiv = document.createElement('div');
                    tempDiv.textContent = accumulatedText;
                    botMessageElement.innerHTML = tempDiv.innerHTML.replace(/\n/g, '<br>');
                }

                // Re-append the like icon to ensure it's at the end
                const existingLikeIcon = botMessageElement.querySelector('.like-icon');
                if (existingLikeIcon) {
                    botMessageElement.appendChild(existingLikeIcon);
                } else {
                    // If for some reason it was not appended or removed, re-add it
                    const likeIcon = document.createElement('span');
                    likeIcon.classList.add('like-icon');
                    likeIcon.innerHTML = likeIconSVG;
                    likeIcon.dataset.messageId = latestBotMessageId;
                    if (finalMetadata.disable === true) { // Check if it was liked
                        likeIcon.classList.add('liked');
                    }
                    botMessageElement.appendChild(likeIcon);
                }

                // Display metadata using the received finalMetadata
                fetchAndDisplayMetadata(botMessageElement, finalMetadata.references || []);
            }

        } catch (error) {
            console.error("Error de fetch o streaming:", error);
            appendMessage("bot", "Hubo un problema al enviar el mensaje. Intenta nuevamente.");
        } finally {
            isGeneratingResponse = false;
            toggleInputAndButtonState(true);
            chatbox.scrollTop = chatbox.scrollHeight;
            currentBotMessageElement = null; // Reset currentBotMessageElement
        }
    }


    // Event listeners existentes
    if (sendBtn && userQueryTextarea) {
        sendBtn.addEventListener('click', sendMessage);
        userQueryTextarea.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isGeneratingResponse) {
                    sendMessage();
                } else {
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

    // Event listener para los cambios de pestaña para cargar las soluciones "likeadas"
    // Este listener se mantiene en app.js porque es parte de la lógica global de navegación
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            if (tabId === 'soluciones') {
                // Llama a la función global para cargar soluciones definida en soluciones.js
                // Asegúrate de que soluciones.js se cargue antes que este script
                if (typeof window.loadLikedSolutions === 'function') {
                    window.loadLikedSolutions(userName, apiEndpoint);
                } else {
                    console.error("loadLikedSolutions no está definida. Asegúrate de que soluciones.js se cargue correctamente.");
                }
                // También llama a la función para procesar soluciones cuando se abre la pestaña
                if (typeof window.processLikedSolutions === 'function') {
                    window.processLikedSolutions(userName, apiEndpoint);
                } else {
                    console.error("processLikedSolutions no está definida. Asegúrate de que soluciones.js se cargue correctamente.");
                }
            }
        });
    });

    // Exportar `toggleLike` y `apiEndpoint` para que `soluciones.js` pueda usarlos.
    // Esto se hace adjuntándolos al objeto `window` para que sean accesibles globalmente.
    window.toggleLike = toggleLike;
    window.apiEndpoint = apiEndpoint;
    window.userName = userName; // También exportar userName para soluciones.js
    window.fetchAndDisplayMetadata = fetchAndDisplayMetadata; // Exportar para soluciones.js
});
