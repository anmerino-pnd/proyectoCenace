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

    let userName = '';
    // currentBotMessageElement ya no se usa para el streaming, sino para operaciones post-streaming
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

    /**
     * Muestra el modal para solicitar el nombre de usuario.
     */
    function requestUsername() {
        const mainAppContainer = document.querySelector('.app-container'); 
        if (mainAppContainer) mainAppContainer.classList.add('hidden');

        if (usernameModal) {
            usernameModal.classList.add('visible');
            usernameModal.classList.remove('hidden');
        }
        if (usernameInput) usernameInput.focus();
    }

    /**
     * Maneja el envío del nombre de usuario desde el modal.
     */
    function handleSubmitUsername() {
        const enteredUsername = usernameInput.value.trim();
        if (enteredUsername) {
            userName = enteredUsername;
            window.userName = userName; 
            if (usernameModal) {
                usernameModal.classList.add('hidden');
                usernameModal.classList.remove('visible');
            }
            const mainAppContainer = document.querySelector('.app-container');
            if (mainAppContainer) mainAppContainer.classList.remove('hidden');

            loadHistory();
            if (userQueryTextarea) userQueryTextarea.focus();
        } else {
            console.warn("Nombre de usuario vacío.");
            // Podrías mostrar un mensaje al usuario aquí
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

    window.apiEndpoint = "http://localhost:8000";

    // Solicitar nombre de usuario al cargar la página
    requestUsername();

    /**
     * Añade un mensaje al contenedor de chat. Esta función ahora solo crea
     * y añade el elemento inicial. El contenido y el Markdown se manejan
     * directamente en la función sendMessage para el streaming.
     * @param {string} sender - El remitente del mensaje ('user' o 'bot').
     * @param {string} initialMessageText - El contenido inicial del mensaje (texto plano).
     * @param {string|null} messageId - El ID único del mensaje (solo para mensajes del bot).
     * @returns {HTMLElement|null} El elemento del mensaje HTML creado.
     */
    function appendMessage(sender, initialMessageText, messageId = null) {
        if (!chatbox) return null;

        const msgDiv = document.createElement("div");
        msgDiv.classList.add("message", sender);

        if (sender === "bot") {
            msgDiv.id = messageId || `bot-message-${Date.now()}`; 
            msgDiv.dataset.messageId = msgDiv.id; 
            // Para el bot, el texto inicial puede ser un placeholder o el primer chunk
            msgDiv.textContent = initialMessageText; 
        } else { // Mensaje de usuario
            // Para mensajes de usuario, renderizar directamente con saltos de línea
            const tempDiv = document.createElement('div');
            tempDiv.textContent = initialMessageText;
            msgDiv.innerHTML = tempDiv.innerHTML.replace(/\n/g, '<br>');
        }
        
        chatbox.appendChild(msgDiv);
        chatbox.scrollTop = chatbox.scrollHeight;
        return msgDiv;
    }

    /**
     * Ajusta la altura del textarea de entrada de usuario.
     */
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

    /**
     * Muestra el indicador de escritura (spinner).
     */
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

    /**
     * Oculta el indicador de escritura (spinner).
     */
    function hideSpinner() {
        if (!chatbox) return;
        const spinner = chatbox.querySelector('.typing-indicator');
        if (spinner) spinner.remove();
    }

    /**
     * Habilita o deshabilita el input de usuario y el botón de enviar.
     * @param {boolean} enabled - True para habilitar, false para deshabilitar.
     */
    function toggleInputAndButtonState(enabled) {
        if (userQueryTextarea) userQueryTextarea.disabled = !enabled;
        if (sendBtn) sendBtn.disabled = !enabled;

        if (enabled) {
            if (sendBtn) sendBtn.classList.remove('disabled-btn');
            if (userQueryTextarea) userQueryTextarea.classList.remove('disabled-input');
            if (sendBtnIconContainer) sendBtnIconContainer.innerHTML = sendIconSVG;
        } else {
            if (sendBtn) sendBtn.classList.add('disabled-btn');
            if (userQueryTextarea) userQueryTextarea.classList.add('disabled-input');
            if (sendBtnIconContainer) sendBtnIconContainer.innerHTML = sendIconSVG; // Mantener el icono de enviar
        }
    }

    /**
     * Carga el historial de chat desde el backend y lo muestra.
     * Esta función maneja mensajes completos, no streaming.
     */
    async function loadHistory() {
        if (!chatbox || !userName) return;
        chatbox.innerHTML = "";
        const loadingMsg = appendMessage("bot", "Cargando conversación...");
        try {
            const response = await fetch(`${window.apiEndpoint}/history/${userName}`); 
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
                    // Para mensajes del bot, el ID ya está disponible
                    const msgElement = appendMessage(sender, msg.content, msg.id);

                    if (sender === "bot" && msgElement) {
                        // Renderizar Markdown directamente al cargar historial (mensajes completos)
                        if (typeof marked !== "undefined") {
                            msgElement.innerHTML = marked.parse(msg.content);
                        } else {
                            const tempDiv = document.createElement('div');
                            tempDiv.textContent = msg.content;
                            msgElement.innerHTML = tempDiv.innerHTML.replace(/\n/g, '<br>');
                        }

                        // Mostrar metadatos
                        if (msg.metadata && msg.metadata.references) {
                            window.fetchAndDisplayMetadata(msgElement, msg.metadata.references);
                        }

                        // Añadir el icono de "me gusta"
                        const likeIcon = document.createElement('span');
                        likeIcon.classList.add('like-icon');
                        likeIcon.innerHTML = likeIconSVG;
                        likeIcon.dataset.messageId = msg.id;
                        if (msg.metadata && msg.metadata.disable === true) {
                            likeIcon.classList.add('liked');
                        }
                        msgElement.appendChild(likeIcon);
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

    /**
     * Muestra el modal de confirmación para eliminar el historial.
     */
    function showDeleteConfirmation() {
        if (deleteConfirmationModalOverlay) {
            deleteConfirmationModalOverlay.classList.remove('hidden');
            deleteConfirmationModalOverlay.classList.add('visible');
        } else {
            console.error('showDeleteConfirmation: Elemento modal overlay no encontrado.');
        }
    }

    /**
     * Oculta el modal de confirmación para eliminar el historial.
     */
    function hideDeleteConfirmation() {
        if (deleteConfirmationModalOverlay) {
            deleteConfirmationModalOverlay.classList.add('hidden');
            deleteConfirmationModalOverlay.classList.remove('visible');
        } else {
            console.error('hideDeleteConfirmation: Elemento modal overlay no encontrado.');
        }
    }

    /**
     * Elimina el historial de chat del backend y del frontend.
     */
    async function deleteHistory() {
        if (!userName) {
            hideDeleteConfirmation();
            console.warn("Attempted to delete history without a username.");
            return;
        }
        try {
            const response = await fetch(`${window.apiEndpoint}/history/${userName}`, { 
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

    /**
     * Obtiene el valor 'k' (número de referencias) del input.
     * @returns {number} El valor de k.
     */
    function getKValue() {
        if (!kValueInput) return 10; // Valor por defecto
        const kValue = parseInt(kValueInput.value);
        return isNaN(kValue) || kValue < 1 ? 10 : kValue; // Asegura que k sea un entero positivo
    }

    /**
     * Obtiene el filtro de metadatos seleccionado.
     * @returns {Object} Un objeto con el filtro de colección o vacío.
     */
    function getFilterMetadata() {
        if (!filterMetadataSelect) return {};

        const selectedValue = filterMetadataSelect.value;

        const filterOptions = {
            "documentos": {"collection": "documentos"},
            "tickets": {"collection": "tickets"},
            "soluciones": {"collection": "soluciones"},
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
            // Asegurarse de que item y item.metadata existan
            if (item && item.metadata && item.metadata.collection === 'documentos') {
                const metadataItemDiv = document.createElement('div');
                metadataItemDiv.classList.add('metadata-item');

                const itemTitle = document.createElement('h6');
                itemTitle.textContent = `Referencia ${index + 1}${item.metadata.title ? ': ' + item.metadata.title : ''}`;
                metadataItemDiv.appendChild(itemTitle);

                const detailsList = document.createElement('ul');
                const fieldsToShow = [
                    'page_number', 'author', 'subject'];
                if (item.metadata["filename"]) {
                    const viewDocumentUrl = `${window.apiEndpoint}/view_document/${encodeURIComponent(item.metadata.filename)}`; 
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

        // Solo añadir la sección si tiene contenido
        if (metadataDetails.hasChildNodes()) {
            metadataSection.appendChild(metadataHeader);
            metadataSection.appendChild(metadataDetails);
            messageElement.appendChild(metadataSection);
            
            metadataHeader.addEventListener('click', () => {
                metadataDetails.classList.toggle('hidden');
                const icon = metadataHeader.querySelector('.toggle-icon');
                if (icon) { 
                    if (metadataDetails.classList.contains('hidden')) {
                        icon.textContent = '+';
                    } else {
                        icon.textContent = '-';
                    }
                }
            });
        }
        if (chatbox) chatbox.scrollTop = chatbox.scrollHeight;
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
            const response = await fetch(`${window.apiEndpoint}/history/${userName}/messages/${messageId}`, { 
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
                if (!messageId) {
                    console.error("No se encontró messageId en el icono de like.");
                    return;
                }
                const isCurrentlyLiked = likeIcon.classList.contains('liked');
                likeIcon.classList.toggle('liked', !isCurrentlyLiked); // Actualización optimista de la UI
                // Pasar una función de callback para recargar soluciones si la pestaña está activa
                toggleLike(messageId, !isCurrentlyLiked, () => {
                    const solutionsTabButton = document.querySelector('.tab-button[data-tab="soluciones"]');
                    if (solutionsTabButton && solutionsTabButton.classList.contains('active')) {
                        // Llamar a la función global para cargar soluciones definida en soluciones.js
                        if (typeof window.loadLikedSolutions === 'function') {
                            window.loadLikedSolutions(userName, window.apiEndpoint); 
                        }
                    }
                });
            }
        });
    }

    /**
     * Envía un mensaje al chatbot y maneja la respuesta en streaming,
     * incluyendo el parseo incremental de Markdown, la aparición de referencias
     * y el icono de "me gusta" en el orden correcto.
     */
    async function sendMessage() {
        isGeneratingResponse = true;
        toggleInputAndButtonState(false); // Deshabilitar input y botón

        const userQuery = userQueryTextarea.value.trim();
        appendMessage("user", userQuery); // Añadir mensaje del usuario
        userQueryTextarea.value = "";
        resizeTextarea();
        if (userQueryTextarea) userQueryTextarea.focus();

        showSpinner(); // Mostrar spinner
        
        let latestBotMessageId = null;
        let finalMetadata = {}; 
        let accumulatedText = ""; 
        let botMessageElement = null; // Referencia al elemento DOM del mensaje del bot

        try {
            const response = await fetch(`${window.apiEndpoint}/chat`, { 
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
                isGeneratingResponse = false; 
                toggleInputAndButtonState(true); 
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunkValue = decoder.decode(value, { stream: true });

                try {
                    const parsedChunk = JSON.parse(chunkValue);
                    if (parsedChunk.message_id && parsedChunk.metadata) {
                        // Este es el objeto final con el message_id y los metadatos
                        latestBotMessageId = parsedChunk.message_id;
                        finalMetadata = parsedChunk.metadata;
                        // Si recibimos los metadatos finales, la transmisión de texto ha terminado.
                        // Salimos del bucle para procesar el texto acumulado y los metadatos.
                        break; 
                    } else {
                        // Si es un JSON pero no el de metadatos finales (ej. error en formato JSON intermedio),
                        // lo tratamos como texto para que no rompa la visualización.
                        accumulatedText += chunkValue;
                        if (!botMessageElement) {
                            hideSpinner();
                            // Crear el elemento de mensaje la primera vez que llega texto
                            botMessageElement = appendMessage("bot", "", latestBotMessageId); 
                        }
                        // Renderizar incrementalmente con Markdown
                        if (typeof marked !== "undefined") {
                            botMessageElement.innerHTML = marked.parse(accumulatedText);
                        } else {
                            botMessageElement.textContent = accumulatedText; // Fallback
                        }
                    }
                } catch (e) {
                    // Si el parseo JSON falla, es un chunk de texto puro.
                    accumulatedText += chunkValue;
                    if (!botMessageElement) {
                        hideSpinner();
                        // Crear el elemento de mensaje la primera vez que llega texto
                        botMessageElement = appendMessage("bot", "", latestBotMessageId); 
                    }
                    // Renderizar incrementalmente con Markdown
                    if (typeof marked !== "undefined") {
                        botMessageElement.innerHTML = marked.parse(accumulatedText);
                    } else {
                        botMessageElement.textContent = accumulatedText; // Fallback
                    }
                }
                chatbox.scrollTop = chatbox.scrollHeight; // Scroll en cada actualización
            }

            // --- Post-streaming processing ---
            // Asegurarse de que el spinner se oculta al finalizar el streaming
            hideSpinner();

            // Si se creó un elemento de mensaje y hay contenido o metadatos finales
            if (botMessageElement) { 
                // Asegurarse de que el ID del elemento coincida con el ID real del mensaje
                if (latestBotMessageId && botMessageElement.id !== latestBotMessageId) {
                    botMessageElement.id = latestBotMessageId;
                    botMessageElement.dataset.messageId = latestBotMessageId;
                }

                // Asegurar que el Markdown final esté renderizado (importante para el último chunk)
                if (typeof marked !== "undefined" && accumulatedText) {
                    botMessageElement.innerHTML = marked.parse(accumulatedText);
                } else {
                    const tempDiv = document.createElement('div');
                    tempDiv.textContent = accumulatedText;
                    botMessageElement.innerHTML = tempDiv.innerHTML.replace(/\n/g, '<br>');
                }

                // 1. Mostrar metadatos usando el finalMetadata recibido (aparecen después del texto)
                if (finalMetadata && finalMetadata.references) {
                    window.fetchAndDisplayMetadata(botMessageElement, finalMetadata.references);
                }

                // 2. Añadir el icono de "me gusta" (aparece después del texto y referencias)
                const likeIcon = document.createElement('span');
                likeIcon.classList.add('like-icon');
                likeIcon.innerHTML = likeIconSVG;
                if (latestBotMessageId) {
                    likeIcon.dataset.messageId = latestBotMessageId;
                }
                if (finalMetadata && finalMetadata.disable === true) {
                    likeIcon.classList.add('liked');
                }
                botMessageElement.appendChild(likeIcon);
            } else if (!botMessageElement && accumulatedText) { 
                // En caso de que haya habido un error que no permitió crear el elemento
                // pero sí acumuló texto (ej. error de servidor no JSON al inicio)
                appendMessage("bot", accumulatedText);
            }


        } catch (error) {
            console.error("Error de fetch o streaming:", error);
            hideSpinner();
            appendMessage("bot", "Hubo un problema al enviar el mensaje. Intenta nuevamente.");
        } finally {
            isGeneratingResponse = false;
            toggleInputAndButtonState(true); // Habilitar input y botón
            if (chatbox) chatbox.scrollTop = chatbox.scrollHeight;
            currentBotMessageElement = null; // Reiniciar
        }
    }


    // Existing event listeners
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
        resizeTextarea(); // Llama para ajustar al cargar
    }
    if (deleteHistoryBtn) deleteHistoryBtn.addEventListener('click', showDeleteConfirmation);
    if (cancelButton) cancelButton.addEventListener('click', hideDeleteConfirmation);
    if (confirmButton) confirmButton.addEventListener('click', deleteHistory);
    
    // Event listener for tab changes to load "liked" solutions
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            if (tabId === 'soluciones') {
                if (typeof window.loadLikedSolutions === 'function') {
                    const currentUserName = window.userName || userName; 
                    const currentApiEndpoint = window.apiEndpoint;
                    if (currentUserName && currentApiEndpoint) {
                        window.loadLikedSolutions(currentUserName, currentApiEndpoint);
                    } else {
                        console.error("Nombre de usuario o API endpoint no disponibles para cargar soluciones.");
                    }
                } else {
                    console.error("loadLikedSolutions is not defined. Make sure soluciones.js is loaded correctly.");
                }
            }
        });
    });

    // Exportar funciones y variables globales necesarias
    window.toggleLike = toggleLike;
    window.fetchAndDisplayMetadata = fetchAndDisplayMetadata;
});
