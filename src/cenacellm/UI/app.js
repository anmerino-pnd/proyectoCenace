document.addEventListener('DOMContentLoaded', () => {
    const chatArea = document.getElementById('chat-area');
    const chatbox = document.getElementById('messages-container');
    const userQueryTextarea = document.getElementById('userQuery');
    const sendBtn = document.getElementById('sendBtn');
    const sendBtnIconContainer = document.getElementById('sendBtnIcon'); // Asegúrate de que este elemento exista en tu HTML
    const deleteHistoryBtn = document.getElementById('deleteHistoryBtn');
    const deleteConfirmationModalOverlay = document.getElementById('delete-confirmation-modal-overlay');
    const cancelButton = deleteConfirmationModalOverlay ? deleteConfirmationModalOverlay.querySelector('.cancel-button') : null;
    const confirmButton = deleteConfirmationModalOverlay ? deleteConfirmationModalOverlay.querySelector('.confirm-button') : null;
    const usernameModal = document.getElementById('username-modal');
    const usernameInput = document.getElementById('username-input');
    const submitUsernameBtn = document.getElementById('submit-username-btn');

    const kValueInput = document.getElementById('k-value');
    const filterMetadataSelect = document.getElementById('filter-metadata');

    // const apiEndpoint = "http://localhost:8000"; // Ya es global a través de window.apiEndpoint
    let userName = '';
    let currentBotMessageElement = null;

    let isGeneratingResponse = false; // Nuevo: Flag para controlar si se está generando una respuesta

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
        // if (chatArea) chatArea.classList.add('hidden'); // chatArea no está definido aquí, es el contenedor principal de la app
        const mainAppContainer = document.querySelector('.app-container'); // Asumiendo que app-container es el principal
        if (mainAppContainer) mainAppContainer.classList.add('hidden');


        if (usernameModal) {
                usernameModal.classList.add('visible');
                usernameModal.classList.remove('hidden');}
        if (usernameInput) usernameInput.focus();
    }

    function handleSubmitUsername() {
        const enteredUsername = usernameInput.value.trim();
        if (enteredUsername) {
            userName = enteredUsername;
            window.userName = userName; // <-- CORRECCIÓN: Actualizar window.userName aquí
            if (usernameModal) {
                usernameModal.classList.add('hidden');
                usernameModal.classList.remove('visible');
            }
            // if (chatArea) chatArea.classList.remove('hidden'); // chatArea no está definido aquí
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

    // Inicializar apiEndpoint globalmente
    window.apiEndpoint = "http://localhost:8000";

    requestUsername();

    /**
     * Añade un mensaje al contenedor de chat.
     * @param {string} sender - El remitente del mensaje ('user' o 'bot').
     * @param {string} message - El contenido del mensaje.
     * @param {boolean} isStreaming - Si el mensaje está siendo transmitido (streaming).
     * @param {string|null} messageId - El ID único del mensaje (solo para mensajes del bot).
     * @returns {HTMLElement|null} El elemento del mensaje HTML creado.
     */
    function appendMessage(sender, message, isStreaming = false, messageId = null) {
        if (!chatbox) return null;

        // Si es un mensaje de bot en streaming y ya tenemos un elemento actual, lo actualizamos
        if (sender === "bot" && isStreaming && currentBotMessageElement) {
            let rawContent = currentBotMessageElement.dataset.rawContent || '';
            rawContent += message;
            currentBotMessageElement.dataset.rawContent = rawContent;

            // Durante el streaming, solo actualiza el textContent para evitar problemas de parseo parcial de Markdown
            currentBotMessageElement.textContent = rawContent;

            // Asegurarse de que el icono de "me gusta" NO se añada repetidamente durante el streaming
            const existingLikeIcon = currentBotMessageElement.querySelector('.like-icon');
            if (existingLikeIcon) {
                existingLikeIcon.remove(); // Eliminar temporalmente para volver a añadir al final
            }

            chatbox.scrollTop = chatbox.scrollHeight;
            return currentBotMessageElement;
        } else {
            // Crear un nuevo elemento de mensaje
            const msgDiv = document.createElement("div");
            if (sender === "bot") {
                // Asignar un ID único al mensaje del bot si no se proporciona
                msgDiv.id = messageId || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                msgDiv.dataset.messageId = msgDiv.id; // Almacenar el ID para un acceso fácil
            }
            msgDiv.classList.add("message", sender);

            if (sender === "bot") {
                currentBotMessageElement = msgDiv;
                msgDiv.dataset.rawContent = message; // Almacenar el contenido sin procesar para streaming
                // Inicialmente, solo mostrar texto plano
                msgDiv.textContent = message;

                // El icono de "me gusta" se añadirá DESPUÉS de que se reciba la respuesta completa y los metadatos
            } else {
                currentBotMessageElement = null; // Reiniciar para mensajes de usuario
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

    // Nuevo: Función para habilitar/deshabilitar el input y el botón de enviar
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

    async function loadHistory() {
        if (!chatbox || !userName) return;
        chatbox.innerHTML = "";
        const loadingMsg = appendMessage("bot", "Cargando conversación...");
        try {
            const response = await fetch(`${window.apiEndpoint}/history/${userName}`); // Usar window.apiEndpoint
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
                    // Pasar el ID del mensaje para los mensajes del bot al cargar el historial
                    const msgElement = appendMessage(sender, msg.content, false, msg.id);

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

                        // Mostrar metadatos primero
                        if (msg.metadata && msg.metadata.references) {
                            // Usar window.fetchAndDisplayMetadata que se exporta globalmente
                            window.fetchAndDisplayMetadata(msgElement, msg.metadata.references);
                        }

                        // Luego, añadir el icono de "me gusta"
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

            const response = await fetch(`${window.apiEndpoint}/history/${userName}`, { // Usar window.apiEndpoint
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
        if (!kValueInput) return 10; // Default k value
        const kValue = parseInt(kValueInput.value);
        return isNaN(kValue) || kValue < 1 ? 10 : kValue; // Ensure k is a positive integer
    }

    function getFilterMetadata() {
        if (!filterMetadataSelect) return {};

        const selectedValue = filterMetadataSelect.value;

        const filterOptions = {
            "documentos": {"collection": "documentos"},
            "tickets": {"collection": "tickets"},
            "soluciones": {"collection": "soluciones"},
            "None": {} // O null, dependiendo de cómo lo maneje tu backend
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
                    const viewDocumentUrl = `${window.apiEndpoint}/view_document/${encodeURIComponent(item.metadata.filename)}`; // Usar window.apiEndpoint
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
                if (icon) { // Verificar que el icono exista
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
            const response = await fetch(`${window.apiEndpoint}/history/${userName}/messages/${messageId}`, { // Usar window.apiEndpoint
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
                            window.loadLikedSolutions(userName, window.apiEndpoint); // Usar window.apiEndpoint
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
        toggleInputAndButtonState(false); // Deshabilitar input y botón

        const userQuery = userQueryTextarea.value.trim();
        appendMessage("user", userQuery);
        userQueryTextarea.value = "";
        resizeTextarea();
        if (userQueryTextarea) userQueryTextarea.focus();

        showSpinner();
        currentBotMessageElement = null; // Reiniciar currentBotMessageElement antes de un nuevo mensaje

        const kValue = getKValue();
        const filterMetadata = getFilterMetadata();

        let latestBotMessageId = null;
        let finalMetadata = {}; // Para almacenar los metadatos recibidos al final del stream
        let accumulatedText = ""; // Para acumular el contenido de texto para el parseo de Markdown

        try {
            const response = await fetch(`${window.apiEndpoint}/chat`, { // Usar window.apiEndpoint
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
                isGeneratingResponse = false; // Asegurarse de resetear el flag
                toggleInputAndButtonState(true); // Y rehabilitar
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let firstChunk = true;
            let botMessageElement = null; // Referencia al elemento del mensaje del bot

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunkValue = decoder.decode(value, { stream: true });

                try {
                    // Intentar parsear el chunk completo como JSON.
                    // Esto es para el objeto de metadatos final que viene como una cadena JSON completa.
                    const parsedChunk = JSON.parse(chunkValue);
                    if (parsedChunk.message_id && parsedChunk.metadata) {
                        latestBotMessageId = parsedChunk.message_id;
                        finalMetadata = parsedChunk.metadata;
                        // Si son los metadatos finales, no los añadimos como texto.
                        // Rompemos el bucle aquí porque la transmisión de texto ha terminado.
                        break; 
                    } else {
                        // Si es un JSON pero no el de metadata final, tratarlo como texto.
                        accumulatedText += chunkValue;
                         if (firstChunk) {
                            hideSpinner();
                            botMessageElement = appendMessage("bot", accumulatedText, false, latestBotMessageId);
                            firstChunk = false;
                        } else if (botMessageElement) { // Asegurarse que botMessageElement existe
                            appendMessage("bot", chunkValue, true); // appendMessage maneja la actualización de currentBotMessageElement
                        }
                    }
                } catch (e) {
                    // Si el parseo falla, es un chunk de texto.
                    accumulatedText += chunkValue;
                    if (firstChunk) {
                        hideSpinner();
                        // Crear el elemento del mensaje con un ID temporal si aún no hay un ID real
                        botMessageElement = appendMessage("bot", accumulatedText, false, latestBotMessageId);
                        firstChunk = false;
                    } else if (botMessageElement) { // Asegurarse que botMessageElement existe
                        // Actualizar el elemento de mensaje existente con el nuevo texto
                        appendMessage("bot", chunkValue, true); // appendMessage maneja la actualización de currentBotMessageElement
                    }
                }
            }

            // Después del streaming, asegurarse de que el ID final del mensaje esté establecido y los metadatos se muestren
            if (botMessageElement) { // Usar botMessageElement que es la referencia al DIV del mensaje
                // Actualizar el ID del elemento con el ID real del backend si es diferente
                if (latestBotMessageId && botMessageElement.id !== latestBotMessageId) {
                    botMessageElement.id = latestBotMessageId;
                    botMessageElement.dataset.messageId = latestBotMessageId;
                }

                // Renderizar el contenido Markdown final
                if (typeof marked !== "undefined" && accumulatedText) {
                    botMessageElement.innerHTML = marked.parse(accumulatedText);
                } else {
                    // Fallback para texto plano
                    const tempDiv = document.createElement('div');
                    tempDiv.textContent = accumulatedText;
                    botMessageElement.innerHTML = tempDiv.innerHTML.replace(/\n/g, '<br>');
                }

                // Mostrar metadatos usando el finalMetadata recibido
                if (finalMetadata && finalMetadata.references) {
                     window.fetchAndDisplayMetadata(botMessageElement, finalMetadata.references);
                }

                // Finalmente, añadir el icono de "me gusta" después de que todo el contenido y los metadatos estén cargados
                const likeIcon = document.createElement('span');
                likeIcon.classList.add('like-icon');
                likeIcon.innerHTML = likeIconSVG;
                if (latestBotMessageId) { // Asegurarse que latestBotMessageId tiene valor
                    likeIcon.dataset.messageId = latestBotMessageId;
                }
                if (finalMetadata && finalMetadata.disable === true) { // Comprobar si fue "likeado"
                    likeIcon.classList.add('liked');
                }
                botMessageElement.appendChild(likeIcon);
            } else if (!botMessageElement && accumulatedText) { // Caso donde solo hubo metadata y no texto, o error.
                 hideSpinner(); // Asegurarse que el spinner se oculta
                 // Si accumulatedText tiene algo (ej. un error en formato texto del stream), mostrarlo.
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
            currentBotMessageElement = null; // Reiniciar currentBotMessageElement
        }
    }


    // Existing event listeners
    if (sendBtn && userQueryTextarea) {
        sendBtn.addEventListener('click', sendMessage);
        userQueryTextarea.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isGeneratingResponse) { // Solo enviar si no se está generando una respuesta
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
    // if (userQueryTextarea) userQueryTextarea.focus(); // Se mueve a después de cargar el historial

    // Event listener for tab changes to load "liked" solutions
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            if (tabId === 'soluciones') {
                if (typeof window.loadLikedSolutions === 'function') {
                    // Asegurarse que userName y apiEndpoint están disponibles y son correctos
                    const currentUserName = window.userName || userName; // Priorizar window.userName si está más actualizado
                    const currentApiEndpoint = window.apiEndpoint;
                    if (currentUserName && currentApiEndpoint) {
                        window.loadLikedSolutions(currentUserName, currentApiEndpoint);
                    } else {
                        console.error("Nombre de usuario o API endpoint no disponibles para cargar soluciones.");
                    }
                } else {
                    console.error("loadLikedSolutions is not defined. Make sure soluciones.js is loaded correctly.");
                }
                // La llamada a processLikedSolutions al abrir la pestaña puede ser redundante si el usuario
                // siempre tiene que hacer clic en el botón. Considera si este comportamiento es el deseado.
                // Por ahora, lo mantendré como estaba.
                if (typeof window.processLikedSolutions === 'function') {
                     const currentUserName = window.userName || userName;
                     const currentApiEndpoint = window.apiEndpoint;
                     if (currentUserName && currentApiEndpoint) {
                        // window.processLikedSolutions(currentUserName, currentApiEndpoint); // Comentado para evitar procesamiento automático
                     }
                }
            }
        });
    });

    // Exportar funciones y variables globales necesarias
    window.toggleLike = toggleLike;
    // window.apiEndpoint = apiEndpoint; // Ya se establece globalmente antes
    // window.userName = userName; // Se actualiza en handleSubmitUsername
    window.fetchAndDisplayMetadata = fetchAndDisplayMetadata;
});
