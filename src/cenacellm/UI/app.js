document.addEventListener('DOMContentLoaded', () => {
    const chatArea = document.getElementById('chat-area');
    const chatbox = document.getElementById('messages-container');
    const userQueryTextarea = document.getElementById('userQuery');
    const sendBtn = document.getElementById('sendBtn');
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
            alert("Por favor, ingresa un nombre de usuario para continuar.");
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
        const maxHeight = 120;
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
            history.forEach(msg => {
                if (msg && typeof msg.role === 'string' && typeof msg.content === 'string') {
                    const sender = msg.role === "user" ? "user" : "bot";
                    appendMessage(sender, msg.content);
                }
            });
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
                alert(`Error al borrar historial: ${response.status} ${response.statusText}`);
                return;
            }

            if (chatbox) {
                chatbox.innerHTML = '';
                appendMessage("bot", `¡Hola ${userName}! ¿En qué puedo ayudarte hoy?`);
            }
        } catch (error) {
            console.error("Error al borrar historial:", error);
            alert(`Error al borrar historial: ${error.message}`);
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

    async function sendMessage() {
        if (!userQueryTextarea || !userQueryTextarea.value.trim() || !userName) {
             if (!userName) alert("Por favor, ingresa tu nombre de usuario primero.");
             return;
        }
        const userQuery = userQueryTextarea.value.trim();
        appendMessage("user", userQuery);
        userQueryTextarea.value = "";
        resizeTextarea();
        userQueryTextarea.focus();
        showSpinner();
        currentBotMessageElement = null;

        const kValue = getKValue();
        const filterMetadata = getFilterMetadata();

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
                    hideSpinner();
                    appendMessage("bot", chunkValue, false);
                    firstChunk = false;
                } else {
                    appendMessage("bot", chunkValue, true);
                }
            }
        } catch (error) {
            console.error("Fetch or streaming error:", error);
            appendMessage("bot", "Hubo un problema al enviar el mensaje. Intenta nuevamente.");
        } finally {
            hideSpinner();
             if (currentBotMessageElement && typeof marked !== "undefined" && currentBotMessageElement.dataset.rawContent) {
                 currentBotMessageElement.innerHTML = marked.parse(currentBotMessageElement.dataset.rawContent);
            }
            currentBotMessageElement = null;
            chatbox.scrollTop = chatbox.scrollHeight;
        }
    }

    if (sendBtn && userQueryTextarea) {
        sendBtn.addEventListener('click', sendMessage);
        userQueryTextarea.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
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