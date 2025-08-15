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

    // New conversation elements
    const newConversationBtn = document.getElementById('newConversationBtn');
    const conversationListDiv = document.getElementById('conversationList');
    const conversationsContainer = document.getElementById('conversationsContainer');
    const deleteConversationModalOverlay = document.getElementById('delete-conversation-modal-overlay');
    const deleteConversationCancelButton = deleteConversationModalOverlay ? deleteConversationModalOverlay.querySelector('.cancel-button') : null;
    const deleteConversationConfirmButton = deleteConversationModalOverlay ? deleteConversationModalOverlay.querySelector('.confirm-button') : null;

    // Custom Alert Modal elements
    const customAlertModalOverlay = document.getElementById('custom-alert-modal-overlay');
    const customAlertMessageDiv = customAlertModalOverlay ? customAlertModalOverlay.querySelector('.modal-message') : null;
    const customAlertOkButton = customAlertModalOverlay ? customAlertModalOverlay.querySelector('.custom-alert-ok-button') : null;
    let customAlertCallback = null; // To store callback for custom alert

    let userName = '';
    window.userName = ''; // Make userName globally accessible
    let currentConversationId = null;
    window.currentConversationId = null; // Make currentConversationId globally accessible
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

    // CORREGIDO: SVG del icono de la papelera
    const trashIconSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6z"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
    `;

    /**
     * Muestra un modal de alerta personalizado.
     * @param {string} message - El mensaje a mostrar en el modal.
     * @param {function} [callback] - Función opcional a ejecutar cuando se cierra el modal.
     */
    function showCustomAlert(message, callback = null) {
        if (customAlertModalOverlay && customAlertMessageDiv) {
            customAlertMessageDiv.textContent = message;
            customAlertCallback = callback; // Store the callback
            customAlertModalOverlay.classList.remove('hidden');
            customAlertModalOverlay.classList.add('visible');
        } else {
            console.error('Custom alert modal elements not found.');
            // Fallback to native alert if custom modal is not available
            window.alert(message);
            if (callback) callback();
        }
    }

    /**
     * Oculta el modal de alerta personalizado.
     */
    function hideCustomAlert() {
        if (customAlertModalOverlay) {
            customAlertModalOverlay.classList.add('hidden');
            customAlertModalOverlay.classList.remove('visible');
        }
        if (customAlertCallback) {
            customAlertCallback(); // Execute callback if it exists
            customAlertCallback = null; // Clear callback
        }
    }

    // Event listener for the custom alert's OK button
    if (customAlertOkButton) {
        customAlertOkButton.addEventListener('click', hideCustomAlert);
    }


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
    async function handleSubmitUsername() {
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

            // Load conversations and then the first one, or create a new one
            await loadConversations();
            if (!currentConversationId && conversationListDiv.children.length > 0) {
                // If no current conversation is set, select the first one in the list
                const firstConversationButton = conversationListDiv.querySelector('.conversation-item-button');
                if (firstConversationButton) {
                    firstConversationButton.click(); // Simulate click to load history
                }
            } else if (!currentConversationId) {
                // If no conversations exist, create a new one
                await createNewConversation();
            } else {
                 loadHistory(currentConversationId); // Load the existing conversation if already set
            }

            if (userQueryTextarea) userQueryTextarea.focus();
        } else {
            console.warn("Nombre de usuario vacío.");
            showCustomAlert("Por favor, ingresa un nombre de usuario para continuar.");
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

    // window.apiEndpoint = "http://localhost:8000";

    // Solicitar nombre de usuario al cargar la página
    requestUsername();

    /**
     * Añade un mensaje al contenedor de chat.
     * @param {string} sender - El remitente del mensaje ('user' o 'bot').
     * @param {string} messageText - El contenido del mensaje (texto plano o Markdown).
     * @param {string|null} messageId - El ID único del mensaje (solo para mensajes del bot).
     * @returns {HTMLElement|null} El elemento del mensaje HTML creado.
     */
    function appendMessage(sender, messageText, messageId = null) {
        if (!chatbox) return null;

        const msgDiv = document.createElement("div");
        msgDiv.classList.add("message", sender);

        if (sender === "bot") {
            msgDiv.id = messageId || `bot-message-${Date.now()}`;
            msgDiv.dataset.messageId = msgDiv.id;
        }

        // Renderizar Markdown si es un mensaje del bot y marked.js está disponible
        // O simplemente establecer el texto para mensajes de usuario o si no hay marked.js
        if (sender === "bot" && typeof marked !== "undefined") {
            msgDiv.innerHTML = marked.parse(messageText);
        } else {
            // Para mensajes de usuario o si marked.js no está disponible,
            // reemplazar saltos de línea por <br> para HTML
            const tempDiv = document.createElement('div');
            tempDiv.textContent = messageText;
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
     * @param {string} convId - El ID de la conversación a cargar.
     */
    async function loadHistory(convId) {
        if (!chatbox || !userName || !convId) return;

        currentConversationId = convId; // Set the current conversation ID
        window.currentConversationId = currentConversationId; // Update global

        // Highlight the active conversation button
        document.querySelectorAll('.conversation-item-button').forEach(btn => {
            if (btn.dataset.conversationId === convId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        chatbox.innerHTML = "";
        const loadingMsg = appendMessage("bot", "Cargando conversación...");
        try {
            const response = await fetch(`${window.API_ENDPOINT}/history/${userName}/${convId}`);
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
                appendMessage("bot", `¡Hola ${userName}! ¿En qué puedo ayudarte hoy en esta conversación?`);
                return;
            }
            for (const msg of history) {
                if (msg && typeof msg.role === 'string' && typeof msg.content === 'string') {
                    const sender = msg.role === "user" ? "user" : "bot";
                    // Para mensajes del bot, el ID ya está disponible
                    const msgElement = appendMessage(sender, msg.content, msg.id);

                    if (sender === "bot" && msgElement) {
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
    window.loadHistory = loadHistory; // Make loadHistory globally accessible

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
     * Elimina el historial de chat del backend y del frontend para la conversación actual.
     */
    async function deleteHistory() {
        if (!userName || !currentConversationId) {
            hideDeleteConfirmation();
            console.warn("Attempted to delete history without a username or conversation ID.");
            return;
        }
        try {
            const response = await fetch(`${window.API_ENDPOINT}/history/${userName}/${currentConversationId}`, {
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
            // After deleting history, refresh the conversation list to update titles if needed
            await loadConversations();
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
        // Si no hay metadatos, limpia cualquier sección existente y retorna.
        if (!messageElement || !Array.isArray(metadataArray) || metadataArray.length === 0) {
            const existingMetadataSection = messageElement.querySelector('.metadata-section');
            if (existingMetadataSection) {
                existingMetadataSection.remove();
            }
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
            // Asegurarse de que item y item.reference existan
            if (item && item.reference) {
                const metadataItemDiv = document.createElement('div');
                metadataItemDiv.classList.add('metadata-item');

                // Determina el tipo de referencia para mostrar un título más descriptivo
                const collectionType = item.metadata?.collection || 'unknown'; // Usa optional chaining
                let referenceTitlePrefix = '';
                let viewDocumentUrl = null;

                if (collectionType === 'documentos') {
                    referenceTitlePrefix = 'Documento';
                    if (item.metadata?.filename) {
                        viewDocumentUrl = `${window.API_ENDPOINT}/view_document/${encodeURIComponent(item.metadata.filename)}`;
                    }
                } else if (collectionType === 'soluciones') {
                    referenceTitlePrefix = 'Solución';
                    // Nota: Actualmente no hay una URL directa para ver soluciones individuales en este frontend.
                    // Si existiera, la añadirías aquí.
                } else if (collectionType === 'tickets') { // NUEVO: Manejo de referencias de tickets
                    referenceTitlePrefix = 'Ticket';
                    // Para tickets, podrías mostrar un enlace para ver el ticket en la pestaña de tickets si fuera navegable
                    // o simplemente su información aquí.
                }
                else {
                    referenceTitlePrefix = 'Referencia'; // Tipo genérico
                }

                // Muestra el prefijo del título y un posible título si está disponible
                const itemTitle = document.createElement('h6');
                itemTitle.textContent = `${referenceTitlePrefix} ${index + 1}${item.metadata?.title ? ': ' + item.metadata.title : ''}`;
                metadataItemDiv.appendChild(itemTitle);

                const detailsList = document.createElement('ul');

                // Siempre muestra el ID de la referencia
                const referenceIdItem = document.createElement('li');
                referenceIdItem.textContent = `ID: ${item.reference}`;
                detailsList.appendChild(referenceIdItem);

                // Añade el enlace "Abrir documento" solo para documentos
                if (viewDocumentUrl) {
                    const sourceItem = document.createElement('a');
                    sourceItem.href = viewDocumentUrl;
                    sourceItem.textContent = 'Abrir documento';
                    sourceItem.target = "_blank";
                    detailsList.appendChild(sourceItem);
                }

                // Muestra condicionalmente otros campos de metadatos (si existen)
                const fieldsToShow = ['page_number', 'author', 'subject', 'source', 'categories']; // Added 'categories' for tickets
                fieldsToShow.forEach(field => {
                    if (item.metadata?.[field]) { // Usa optional chaining para item.metadata
                        const listItem = document.createElement('li');
                        // Para categorías, podríamos querer un estilo diferente si es necesario
                        if (field === 'categories') {
                             listItem.innerHTML = `${field.replace('_', ' ')}: <span class="ticket-category-pill-small">${item.metadata[field]}</span>`;
                        } else {
                            listItem.textContent = `${field.replace('_', ' ')}: ${item.metadata[field]}`;
                        }
                        detailsList.appendChild(listItem);
                    }
                });

                metadataItemDiv.appendChild(detailsList);
                metadataDetails.appendChild(metadataItemDiv);
            }
        });

        // Solo añade la sección de metadatos si hay elementos para mostrar
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
        } else {
            // Si después de procesar, no hay elementos de metadatos válidos para mostrar,
            // elimina la sección si se había añadido previamente (por ejemplo, de una respuesta incompleta del backend).
            const existingMetadataSection = messageElement.querySelector('.metadata-section');
            if (existingMetadataSection) {
                existingMetadataSection.remove();
            }
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
            // First, update the message metadata (like/unlike)
            const response = await fetch(`${window.API_ENDPOINT}/history/${userName}/messages/${messageId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_metadata: { disable: isLiked } })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error al actualizar los metadatos del mensaje: ${response.status}`, errorText);
                return; // Exit if initial update fails
            }

            // If unliking (isLiked is false), trigger deletion from vectorstore
            if (!isLiked) {
                try {
                    const deleteResponse = await fetch(`${window.API_ENDPOINT}/delete_solution`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reference_ids: [messageId] }) // Pass messageId as reference_id
                    });

                    if (!deleteResponse.ok) {
                        const errorText = await deleteResponse.text();
                        console.error(`Error al eliminar la solución del vectorstore: ${deleteResponse.status}`, errorText);
                        // Optional: Revert the like status in UI if deletion fails
                        // messageElement.querySelector('.like-icon').classList.add('liked');
                    } else {
                        console.log(`Solución con ID ${messageId} eliminada del vectorstore.`);
                    }
                } catch (deleteError) {
                    console.error("Error de red al eliminar solución del vectorstore:", deleteError);
                }
            } else {
                // If liking (isLiked is true), process it to add to vectorstore
                try {
                    const processResponse = await fetch(`${window.API_ENDPOINT}/process_liked_solutions/${userName}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (!processResponse.ok) {
                        const errorText = await processResponse.text();
                        console.error(`Error al procesar soluciones 'likeadas': ${processResponse.status}`, errorText);
                    } else {
                        console.log(`Solución con ID ${messageId} procesada y añadida al vectorstore.`);
                    }
                } catch (processError) {
                    console.error("Error de red al procesar soluciones 'likeadas':", processError);
                }
            }

            // Always run the callback after the main update and deletion/processing attempts
            if (callback && typeof callback === 'function') {
                callback();
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
                // Optimistically update the UI *before* backend call
                likeIcon.classList.toggle('liked', !isCurrentlyLiked);

                toggleLike(messageId, !isCurrentlyLiked, () => {
                    const solutionsTabButton = document.querySelector('.tab-button[data-tab="soluciones"]');
                    if (solutionsTabButton && solutionsTabButton.classList.contains('active')) {
                        // Llamar a la función global para cargar soluciones definida en soluciones.js
                        if (typeof window.loadLikedSolutions === 'function') {
                            window.loadLikedSolutions(userName, window.API_ENDPOINT);
                        }
                    }
                    // If tickets tab is active, reload it to reflect potential solved status change
                    const ticketsTabButton = document.querySelector('.tab-button[data-tab="tickets"]');
                    if (ticketsTabButton && ticketsTabButton.classList.contains('active')) {
                        if (typeof window.loadTickets === 'function') {
                            window.loadTickets();
                        }
                    }
                    // No need to explicitly reload chat history here; the backend already manages 'disable' state,
                    // and if user switches tabs, loadHistory will be called anyway, reflecting the correct state.
                    // For immediate visual feedback on the same tab, optimistic update is sufficient.
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
        if (!currentConversationId) {
            console.warn("No hay conversación activa. Por favor, crea o selecciona una.");
            showCustomAlert("No hay conversación activa. Por favor, crea o selecciona una para empezar a chatear.");
            return;
        }

        if (isGeneratingResponse) {
            console.log("Ya se está generando una respuesta. Espera a que termine.");
            return;
        }

        isGeneratingResponse = true;
        toggleInputAndButtonState(false); // Deshabilitar input y botón

        const userQuery = userQueryTextarea.value.trim();
        if (!userQuery) {
            isGeneratingResponse = false;
            toggleInputAndButtonState(true);
            return;
        }
        appendMessage("user", userQuery); // Añadir mensaje del usuario
        userQueryTextarea.value = "";
        resizeTextarea();
        if (userQueryTextarea) userQueryTextarea.focus();

        showSpinner(); // Mostrar spinner

        let latestBotMessageId = null;
        let finalMetadata = {};
        let accumulatedText = "";
        let botMessageElement = null; // Referencia al elemento DOM del mensaje del bot

        // Obtener los valores de k y filter_metadata aquí, justo antes de enviarlos
        const kValue = getKValue();
        const filterMetadata = getFilterMetadata();

        try {
            const response = await fetch(`${window.API_ENDPOINT}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
                body: JSON.stringify({
                    user_id: userName,
                    conversation_id: currentConversationId, // Pass current conversation ID
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
                    errorMessage += `: ${errorText.substring(0, 100)}...`;
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

                // MODIFICADO: Intentar extraer el JSON final del chunk.
                // Esto maneja el caso donde el último token de texto y el JSON vienen juntos.
                const finalDataRegex = /(.*?)({.*"final_message_data":.*})\s*$/s; // '\s*$' para capturar posibles espacios/saltos de línea al final
                const match = chunkValue.match(finalDataRegex);

                if (match) {
                    // Si hay un match, el chunk contiene texto + JSON final
                    const textPart = match[1];
                    const jsonPart = match[2];

                    // Añadir la parte de texto al acumulado
                    accumulatedText += textPart;

                    // Asegurar que el elemento del bot existe y actualizar su contenido con el texto
                    if (!botMessageElement) {
                        hideSpinner();
                        botMessageElement = appendMessage("bot", "", latestBotMessageId);
                    }
                    // Update content with Markdown parsing for each chunk
                    if (typeof marked !== "undefined") {
                        botMessageElement.innerHTML = marked.parse(accumulatedText);
                    } else {
                        const tempDiv = document.createElement('div');
                        tempDiv.textContent = accumulatedText;
                        botMessageElement.innerHTML = tempDiv.innerHTML.replace(/\n/g, '<br>');
                    }
                    chatbox.scrollTop = chatbox.scrollHeight;

                    // Intentar parsear la parte JSON
                    try {
                        const parsedFinalChunk = JSON.parse(jsonPart);
                        if (parsedFinalChunk.final_message_data) {
                            latestBotMessageId = parsedFinalChunk.final_message_data.message_id;
                            finalMetadata = parsedFinalChunk.final_message_data.metadata;
                            // ¡Hemos encontrado el JSON final! Salir del bucle de streaming.
                            break;
                        }
                    } catch (e) {
                        console.error("Error al parsear la parte JSON final:", e);
                        // Si el parseo de la parte JSON falla, añadirla al texto como fallback (no deseado, pero mejor que perderla)
                        accumulatedText += jsonPart;
                        if (typeof marked !== "undefined") {
                            botMessageElement.innerHTML = marked.parse(accumulatedText);
                        } else {
                            const tempDiv = document.createElement('div');
                            tempDiv.textContent = accumulatedText;
                            botMessageElement.innerHTML = tempDiv.innerHTML.replace(/\n/g, '<br>');
                        }
                    }
                } else {
                    // Si no hay match, el chunk es texto puro (o un JSON que no es el final_message_data)
                    // En tu caso, los chunks intermedios no deberían ser JSONs válidos, así que se tratarán como texto.
                    accumulatedText += chunkValue;
                    if (!botMessageElement) {
                        hideSpinner();
                        botMessageElement = appendMessage("bot", "", latestBotMessageId);
                    }
                    // Update content with Markdown parsing for each chunk
                    if (typeof marked !== "undefined") {
                        botMessageElement.innerHTML = marked.parse(accumulatedText);
                    } else {
                        const tempDiv = document.createElement('div');
                        tempDiv.textContent = accumulatedText;
                        botMessageElement.innerHTML = tempDiv.innerHTML.replace(/\n/g, '<br>');
                    }
                    chatbox.scrollTop = chatbox.scrollHeight;
                }
            }

            // --- Procesamiento Post-streaming (después de que el bucle de lectura haya terminado) ---
            hideSpinner();

            if (botMessageElement) {
                if (latestBotMessageId && botMessageElement.id !== latestBotMessageId) {
                    botMessageElement.id = latestBotMessageId;
                    botMessageElement.dataset.messageId = latestBotMessageId;
                }

                // 1. Mostrar metadatos usando el finalMetadata recibido
                if (finalMetadata && finalMetadata.references) {
                    window.fetchAndDisplayMetadata(botMessageElement, finalMetadata.references);
                }

                // 2. Añadir el icono de "me gusta"
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
                // Fallback if botMessageElement was never created (shouldn't happen with current logic)
                appendMessage("bot", accumulatedText);
            }

            // After sending a message, reload conversations to update the title of the current one
            await loadConversations();


        } catch (error) {
            console.error("Error de fetch o streaming:", error);
            hideSpinner();
            appendMessage("bot", "Hubo un problema al enviar el mensaje. Intenta nuevamente.");
        } finally {
            isGeneratingResponse = false;
            toggleInputAndButtonState(true);
            if (chatbox) chatbox.scrollTop = chatbox.scrollHeight;
        }
    }


    /**
     * Carga y muestra la lista de conversaciones del usuario.
     */
    async function loadConversations() {
        if (!userName || !conversationListDiv) return;

        conversationListDiv.innerHTML = '<p class="loading-conversations-message">Cargando conversaciones...</p>';
        try {
            const response = await fetch(`${window.API_ENDPOINT}/conversations/${userName}`);
            if (!response.ok) {
                const errorText = await response.text();
                conversationListDiv.innerHTML = `<p class="error-conversations-message">Error al cargar conversaciones: ${errorText}</p>`;
                console.error("Error fetching conversations:", errorText);
                return;
            }

            const conversations = await response.json();
            conversationListDiv.innerHTML = ''; // Clear loading message

            if (!Array.isArray(conversations) || conversations.length === 0) {
                conversationListDiv.innerHTML = '<p class="no-conversations-message">No tienes conversaciones aún.</p>';
                return;
            }

            conversations.forEach(conv => {
                const convItem = document.createElement('div');
                convItem.classList.add('conversation-item');
                convItem.dataset.conversationId = conv.conversation_id;

                const convButton = document.createElement('button');
                convButton.classList.add('conversation-item-button');
                convButton.dataset.conversationId = conv.conversation_id;
                convButton.textContent = conv.title || "Conversación sin título"; // Use title from backend
                
                // Add active class if this is the current conversation
                if (conv.conversation_id === currentConversationId) {
                    convButton.classList.add('active');
                }

                // Delete button for each conversation
                const deleteConvButton = document.createElement('button');
                deleteConvButton.classList.add('delete-conversation-button');
                deleteConvButton.innerHTML = trashIconSVG; // Use the corrected SVG
                deleteConvButton.dataset.conversationId = conv.conversation_id;
                deleteConvButton.title = "Eliminar conversación";


                convButton.addEventListener('click', () => loadHistory(conv.conversation_id));
                deleteConvButton.addEventListener('click', (event) => {
                    event.stopPropagation(); // Prevent loading history when deleting
                    showDeleteConversationConfirmation(conv.conversation_id);
                });

                convItem.appendChild(convButton);
                convItem.appendChild(deleteConvButton);
                conversationListDiv.appendChild(convItem);
            });
        } catch (error) {
            console.error("Error loading conversations:", error);
            conversationListDiv.innerHTML = '<p class="error-conversations-message">Error al cargar las conversaciones.</p>';
        }
    }

    /**
     * Crea una nueva conversación y la carga.
     * @param {string} [title] - Título opcional para la nueva conversación.
     */
    async function createNewConversation(title = null) {
        if (!userName) {
            console.warn("No se puede crear una nueva conversación sin nombre de usuario.");
            showCustomAlert("Por favor, ingresa tu nombre de usuario para crear una nueva conversación.");
            return;
        }
        try {
            const payload = { user_id: userName };
            if (title) {
                payload.title = title;
            }
            const response = await fetch(`${window.API_ENDPOINT}/new_conversation`, { // Changed endpoint
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (response.ok && result.conversation_id) {
                currentConversationId = result.conversation_id;
                window.currentConversationId = currentConversationId; // Update global
                await loadConversations(); // Reload conversation list to show new one
                loadHistory(currentConversationId); // Load the empty new conversation
            } else {
                console.error("Error creating new conversation:", result.detail || response.statusText);
                showCustomAlert(`Error al crear nueva conversación: ${result.detail || response.statusText}`);
            }
        } catch (error) {
            console.error("Error de red al crear nueva conversación:", error);
            showCustomAlert(`Error de red al crear nueva conversación: ${error.message}`);
        }
    }

    /**
     * Muestra el modal de confirmación para eliminar una conversación.
     * @param {string} convIdToDelete - El ID de la conversación a eliminar.
     */
    let conversationIdToDelete = null; // Store the ID temporarily
    function showDeleteConversationConfirmation(convId) {
        conversationIdToDelete = convId;
        if (deleteConversationModalOverlay) {
            deleteConversationModalOverlay.classList.remove('hidden');
            deleteConversationModalOverlay.classList.add('visible');
        }
    }

    /**
     * Oculta el modal de confirmación para eliminar una conversación.
     */
    function hideDeleteConversationConfirmation() {
        if (deleteConversationModalOverlay) {
            deleteConversationModalOverlay.classList.add('hidden');
            deleteConversationModalOverlay.classList.remove('visible');
        }
        conversationIdToDelete = null;
    }

    /**
     * Elimina una conversación específica del backend y actualiza la UI.
     */
    async function deleteSpecificConversation() {
        if (!userName || !conversationIdToDelete) {
            hideDeleteConversationConfirmation();
            console.warn("No hay nombre de usuario o ID de conversación para eliminar.");
            return;
        }

        try {
            const response = await fetch(`${windowwindow.API_ENDPOINT}/delete_conversation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userName, conversation_id: conversationIdToDelete })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error ${response.status}:`, errorText);
                showCustomAlert(`Error al eliminar conversación: ${response.status} - ${errorText}`);
            } else {
                // If the deleted conversation was the current one, switch to a new one
                if (currentConversationId === conversationIdToDelete) {
                    currentConversationId = null; // Clear current conversation
                    window.currentConversationId = null; // Update global
                    await createNewConversation(); // Create and load a new empty one
                } else {
                    await loadConversations(); // Just reload the list
                }
            }
        } catch (error) {
            console.error("Error deleting conversation:", error);
            showCustomAlert(`Error de red al eliminar conversación: ${error.message}`);
        } finally {
            hideDeleteConversationConfirmation();
        }
    }

    /**
     * Función para cambiar la pestaña activa.
     * @param {string} tabId - El ID de la pestaña a activar (ej. 'chat', 'documentos', 'soluciones', 'tickets').
     */
    function changeTab(tabId) {
        // Eliminar 'active' de todos los botones de pestaña y 'hidden' de todos los contenidos
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));

        // Añadir 'active' al botón clickeado y mostrar su contenido
        const clickedButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
        const targetContent = document.getElementById(`${tabId}-tab-content`);

        if (clickedButton) clickedButton.classList.add('active');
        if (targetContent) targetContent.classList.remove('hidden');

        // Disparar carga de contenido para la pestaña específica si es necesario
        if (tabId === 'soluciones') {
            if (typeof window.loadLikedSolutions === 'function') {
                const currentUserName = window.userName || userName;
                if (currentUserName && window.API_ENDPOINT) {
                    window.loadLikedSolutions(currentUserName);
                } else {
                    console.error("Nombre de usuario o API endpoint no disponibles para cargar soluciones.");
                    showCustomAlert("No se pudo cargar las soluciones. Por favor, asegúrate de haber iniciado sesión.");
                }
            } else {
                console.error("loadLikedSolutions is not defined. Make sure soluciones.js is loaded correctly.");
                showCustomAlert("Error interno: La funcionalidad de soluciones no está disponible.");
            }
        } else if (tabId === 'tickets') {
            if (typeof window.loadTickets === 'function') {
                window.loadTickets();
            } else {
                console.error("loadTickets is not defined. Make sure tickets.js is loaded correctly.");
                showCustomAlert("Error interno: La funcionalidad de tickets no está disponible.");
            }
        } else if (tabId === 'documentos') {
             // Assuming fetchAndDisplayDocuments is global or called from documentos.js DOMContentLoaded
             // If it's not called on DOMContentLoaded, you might need a global window.fetchAndDisplayDocuments
             // or a more robust module pattern. For now, it's called on DOMContentLoaded in documentos.js
             // so it should be loaded when the tab is first accessed.
        }
        else if (tabId === 'chat') {
            if (window.currentConversationId && window.loadHistory) {
                window.loadHistory(window.currentConversationId); // Recargar historial de chat
            }
        }
    }
    window.changeTab = changeTab; // Hacer changeTab accesible globalmente
    window.showCustomAlert = showCustomAlert; // Make custom alert globally accessible


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
                    showCustomAlert("Por favor, espera a que el chatbot termine de responder antes de enviar un nuevo mensaje.");
                }
            }
        });
        userQueryTextarea.addEventListener('input', resizeTextarea);
        resizeTextarea(); // Llama para ajustar al cargar
    }
    if (deleteHistoryBtn) deleteHistoryBtn.addEventListener('click', showDeleteConfirmation);
    if (cancelButton) cancelButton.addEventListener('click', hideDeleteConfirmation);
    if (confirmButton) confirmButton.addEventListener('click', deleteHistory);

    // New conversation event listener
    if (newConversationBtn) {
        newConversationBtn.addEventListener('click', () => createNewConversation()); // Call without title
    }

    // Delete conversation modal buttons
    if (deleteConversationCancelButton) deleteConversationCancelButton.addEventListener('click', hideDeleteConversationConfirmation);
    if (deleteConversationConfirmButton) deleteConversationConfirmButton.addEventListener('click', deleteSpecificConversation);


    // Event listener for tab changes to load content
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            changeTab(tabId); // Use the new changeTab function
        });
    });

    // Exportar funciones y variables globales necesarias
    window.toggleLike = toggleLike;
    window.fetchAndDisplayMetadata = fetchAndDisplayMetadata;
});
