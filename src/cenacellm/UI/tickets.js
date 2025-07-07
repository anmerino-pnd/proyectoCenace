// tickets.js
document.addEventListener('DOMContentLoaded', () => {
    const apiEndpoint = "http://localhost:8000";
    const ticketListUl = document.getElementById('ticketList');
    const addTicketBtn = document.getElementById('addTicketBtn');
    const ticketStatusDiv = document.getElementById('ticketStatus');

    // Add Ticket Modal elements
    const addTicketModalOverlay = document.getElementById('add-ticket-modal-overlay');
    const cancelAddTicketBtn = document.getElementById('cancelAddTicketBtn');
    const submitAddTicketBtn = document.getElementById('submitAddTicketBtn');
    const ticketTitleInput = document.getElementById('ticket-title-input');
    const ticketDescriptionInput = document.getElementById('ticket-description-input');
    const ticketCategoryInput = document.getElementById('ticket-category-input');

    /**
     * Muestra un mensaje de estado en el elemento especificado.
     * @param {HTMLElement} element - El elemento HTML donde se mostrará el mensaje.
     * @param {string} message - El mensaje a mostrar.
     * @param {string} type - El tipo de mensaje ('success', 'error', o vacío para neutral).
     */
    function showStatus(element, message, type) {
        if (element) {
            element.textContent = message;
            element.className = 'status-message'; // Reinicia las clases
            if (type) {
                element.classList.add(type);
            }
        }
    }

    /**
     * Carga y muestra la lista de tickets en la interfaz.
     */
    async function loadTickets() {
        if (!ticketListUl) return;
        ticketListUl.innerHTML = '<li>Cargando tickets...</li>';
        try {
            const response = await fetch(`${apiEndpoint}/tickets`);
            if (!response.ok) {
                const errorText = await response.text();
                ticketListUl.innerHTML = `<li>Error al cargar tickets: ${response.status} - ${errorText}</li>`;
                console.error("Error fetching tickets:", errorText);
                return;
            }

            const tickets = await response.json();
            ticketListUl.innerHTML = ''; // Clear loading message

            if (!Array.isArray(tickets) || tickets.length === 0) {
                ticketListUl.innerHTML = '<li>No hay tickets disponibles.</li>';
                return;
            }

            tickets.forEach(ticket => {
                const listItem = document.createElement('li');
                listItem.classList.add('ticket-item');
                // Add solved class if applicable
                if (ticket.is_solved) {
                    listItem.classList.add('ticket-solved');
                }
                // Almacena la referencia del ticket y el objeto completo para uso posterior
                listItem.dataset.ticketReference = ticket.reference;

                const titleBar = document.createElement('div');
                titleBar.classList.add('ticket-title-bar');
                titleBar.innerHTML = `
                    <span>${ticket.titulo}</span>
                    <span class="toggle-icon">+</span>
                `;
                // Add a visual indicator for solved directly in the title bar
                if (ticket.is_solved) {
                    const solvedIndicator = document.createElement('span');
                    solvedIndicator.classList.add('ticket-solved-indicator');
                    solvedIndicator.innerHTML = '<i class="fas fa-check-circle"></i> Resuelto';
                    titleBar.appendChild(solvedIndicator);
                }

                const detailsContent = document.createElement('div');
                detailsContent.classList.add('ticket-details-content', 'hidden'); // Asegurarse que inicia oculto

                detailsContent.innerHTML = `
                    <p><strong>Descripción:</strong> ${ticket.descripcion}</p>
                    <p><strong>Categoría:</strong> <span class="ticket-category-pill">${ticket.categories}</span></p>
                    ${ticket.solucion_id ? `<p><strong>ID Conversación Solución:</strong> ${ticket.solucion_id}</p>` : ''}
                `;

                // Add "Llevar ticket a la conversación" button
                const actionsRow = document.createElement('div');
                actionsRow.classList.add('ticket-actions-row');
                const bringToChatBtn = document.createElement('button');
                bringToChatBtn.classList.add('minimal-primary-button');
                bringToChatBtn.textContent = ticket.solucion_id ? 'Ir a Conversación' : 'Llevar ticket a la conversación'; // Change button text
                bringToChatBtn.addEventListener('click', (event) => {
                    event.stopPropagation(); // Prevent toggling details
                    bringTicketToConversation(ticket.titulo, ticket.descripcion, ticket.reference, ticket.solucion_id);
                });
                actionsRow.appendChild(bringToChatBtn);
                detailsContent.appendChild(actionsRow);


                titleBar.addEventListener('click', () => {
                    detailsContent.classList.toggle('hidden'); // Toggles 'hidden'
                    detailsContent.classList.toggle('visible'); // Toggles 'visible'
                    const icon = titleBar.querySelector('.toggle-icon');
                    if (detailsContent.classList.contains('hidden')) {
                        icon.textContent = '+';
                    } else {
                        icon.textContent = '-';
                    }
                });

                listItem.appendChild(titleBar);
                listItem.appendChild(detailsContent);
                ticketListUl.appendChild(listItem);
            });
        } catch (error) {
            console.error("Error al cargar tickets:", error);
            ticketListUl.innerHTML = '<li>Hubo un problema al cargar los tickets.</li>';
        }
    }

    /**
     * Muestra el modal para agregar un nuevo ticket.
     */
    function showAddTicketModal() {
        if (addTicketModalOverlay) {
            addTicketModalOverlay.classList.remove('hidden');
            addTicketModalOverlay.classList.add('visible');
            // Clear previous input values
            ticketTitleInput.value = '';
            ticketDescriptionInput.value = '';
            ticketCategoryInput.value = '';
        }
    }

    /**
     * Oculta el modal para agregar un nuevo ticket.
     */
    function hideAddTicketModal() {
        if (addTicketModalOverlay) {
            addTicketModalOverlay.classList.add('hidden');
            addTicketModalOverlay.classList.remove('visible');
        }
        showStatus(ticketStatusDiv, '', ''); // Clear status message
    }

    /**
     * Envía los datos del nuevo ticket al backend.
     */
    async function submitNewTicket() {
        const titulo = ticketTitleInput.value.trim();
        const descripcion = ticketDescriptionInput.value.trim();
        const categories = ticketCategoryInput.value.trim();

        if (!titulo || !descripcion || !categories) {
            showStatus(ticketStatusDiv, "Todos los campos son obligatorios.", 'error');
            return;
        }

        showStatus(ticketStatusDiv, '<i class="fas fa-spinner fa-spin"></i> Agregando ticket...', '');
        submitAddTicketBtn.disabled = true;
        cancelAddTicketBtn.disabled = true;

        try {
            const response = await fetch(`${apiEndpoint}/tickets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ titulo, descripcion, categories })
            });

            const result = await response.json();

            if (response.ok) {
                showStatus(ticketStatusDiv, `Ticket "${result.titulo}" agregado exitosamente.`, 'success');
                hideAddTicketModal();
                loadTickets(); // Reload list to show the new ticket
            } else {
                showStatus(ticketStatusDiv, `Error al agregar ticket: ${result.detail || response.statusText}`, 'error');
            }
        } catch (error) {
            console.error("Error al agregar ticket:", error);
            showStatus(ticketStatusDiv, `Error de red al agregar ticket: ${error.message}`, 'error');
        } finally {
            submitAddTicketBtn.disabled = false;
            cancelAddTicketBtn.disabled = false;
        }
    }

    /**
     * Lleva el título y la descripción de un ticket a la conversación principal.
     * Actualiza el ticket en la base de datos con el ID de la conversación.
     * @param {string} ticketTitle - El título del ticket.
     * @param {string} ticketDescription - La descripción del ticket.
     * @param {string} ticketReference - La referencia (UUID) del ticket.
     * @param {string|null} existingSolucionId - El solucion_id actual del ticket, si existe.
     */
    async function bringTicketToConversation(ticketTitle, ticketDescription, ticketReference, existingSolucionId) {
        if (!window.userName) {
            window.showCustomAlert("Por favor, ingresa tu nombre de usuario para comenzar un chat.");
            return;
        }

        let conversationIdToUse = existingSolucionId;
        const chatbox = document.getElementById('messages-container');

        if (!conversationIdToUse) {
            // No existing conversation for this ticket, create a new one
            try {
                showStatus(ticketStatusDiv, '<i class="fas fa-spinner fa-spin"></i> Creando nueva conversación...', '');
                const newConversationResponse = await fetch(`${apiEndpoint}/new_conversation`, { // Changed endpoint
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: window.userName, title: ticketTitle }) // Pass user_id and title
                });
                const newConversationResult = await newConversationResponse.json();

                if (!newConversationResponse.ok || !newConversationResult.conversation_id) {
                    throw new Error(newConversationResult.detail || newConversationResponse.statusText);
                }
                conversationIdToUse = newConversationResult.conversation_id;
                showStatus(ticketStatusDiv, 'Nueva conversación creada exitosamente.', 'success');

                // Update the ticket in the database with the new conversation_id
                const updateResponse = await fetch(`${apiEndpoint}/tickets/${ticketReference}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ new_metadata: { solucion_id: conversationIdToUse } })
                });

                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    console.error(`Error al actualizar el ticket con el ID de conversación: ${updateResponse.status} - ${errorText}`);
                    showStatus(ticketStatusDiv, "Error al vincular el ticket con la nueva conversación.", 'error');
                    return;
                }
                console.log(`Ticket ${ticketReference} vinculado a la nueva conversación ${conversationIdToUse}.`);
                showStatus(ticketStatusDiv, 'Ticket vinculado a la conversación.', 'success');

                // Now, send the initial context message to the chatbot
                if (typeof window.loadHistory === 'function' && typeof window.changeTab === 'function') {
                    await window.loadHistory(conversationIdToUse); // Load the new conversation
                    window.changeTab('chat'); // Switch to chat tab
                    showStatus(ticketStatusDiv, '', ''); // Clear status message after successful action

                    const userQueryTextarea = document.getElementById('userQuery');
                    const sendButton = document.getElementById('sendBtn');

                    if (userQueryTextarea && sendButton) {
                        const contextMessage = `Solo quiero que leas la información y entiendas el contexto de lo que está sucediendo, comprender el problema y entender lo que pasa.
Contexto del ticket:
"""
Título: ${ticketTitle}
Descripción: ${ticketDescription}
"""
`;
                        userQueryTextarea.value = contextMessage;

                        const event = new Event('input', { bubbles: true });
                        userQueryTextarea.dispatchEvent(event);

                        sendButton.click(); // Simulate a click on the send button

                        if (chatbox) {
                            chatbox.scrollTop = chatbox.scrollHeight;
                        }
                    } else {
                        console.error("Elementos del chat no encontrados para pasar el ticket.");
                        window.showCustomAlert("No se pudo pasar el ticket al chat. Recarga la página y vuelve a intentarlo.");
                    }
                } else {
                    console.error("Funciones globales (loadHistory, changeTab) no disponibles.");
                    window.showCustomAlert("Funciones internas del chat no disponibles. Recarga la página.");
                }

            } catch (error) {
                console.error("Error al crear o vincular nueva conversación:", error);
                showStatus(ticketStatusDiv, `Error: ${error.message}`, 'error');
                return;
            }
        } else {
            // Conversation already exists, just navigate
            showStatus(ticketStatusDiv, '<i class="fas fa-info-circle"></i> Cargando conversación existente...', '');
            if (typeof window.loadHistory === 'function' && typeof window.changeTab === 'function') {
                await window.loadHistory(conversationIdToUse); // Load the existing conversation
                window.changeTab('chat'); // Switch to chat tab
                showStatus(ticketStatusDiv, '', ''); // Clear status message

                // Do NOT send another message if it's an existing conversation
                if (chatbox) {
                    chatbox.scrollTop = chatbox.scrollHeight;
                }
            } else {
                console.error("Funciones globales (loadHistory, changeTab) no disponibles.");
                window.showCustomAlert("Funciones internas del chat no disponibles. Recarga la página.");
            }
        }
        loadTickets(); // Reload ticket list to reflect any changes like new solucion_id or solved status
    }

    // Event Listeners
    if (addTicketBtn) addTicketBtn.addEventListener('click', showAddTicketModal);
    if (cancelAddTicketBtn) cancelAddTicketBtn.addEventListener('click', hideAddTicketModal);
    if (submitAddTicketBtn) submitAddTicketBtn.addEventListener('click', submitNewTicket);

    // Exportación de funciones para ser utilizadas globalmente (e.g., por app.js)
    window.loadTickets = loadTickets;
    window.bringTicketToConversation = bringTicketToConversation;

    // Cargar tickets cuando la pestaña de tickets se activa por primera vez
    // Esto se maneja en app.js cuando se cambia de pestaña.
});
