document.addEventListener('DOMContentLoaded', () => {
    const chatArea = document.getElementById('chat-area');
    const chatbox = document.getElementById('messages-container');
    const userQueryTextarea = document.getElementById('userQuery');
    const sendBtn = document.getElementById('sendBtn');
    const deleteHistoryBtn = document.getElementById('deleteHistoryBtn');
    const modalOverlay = document.querySelector('.modal-overlay');
    const cancelButton = document.querySelector('.cancel-button');
    const confirmButton = document.querySelector('.confirm-button');

    const apiEndpoint = "http://localhost:80";
    const userName = 'default_user'; // Usuario fijo
    let currentBotMessageElement = null;

    // Mostrar el chat directamente al cargar
    if (chatArea) chatArea.classList.remove('hidden');
    
    // Cargar historial al iniciar
    loadHistory();

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
                currentBotMessageElement.innerHTML = tempDiv.innerHTML;
            }

            chatbox.scrollTop = chatbox.scrollHeight;
            return currentBotMessageElement;
        } else {
            const msgDiv = document.createElement("div");
            msgDiv.classList.add("message", sender);

            if (sender === "bot") {
                currentBotMessageElement = msgDiv;
                msgDiv.dataset.rawContent = message;
                if (typeof marked !== "undefined") {
                    msgDiv.innerHTML = marked.parse(message);
                } else {
                    const tempDiv = document.createElement('div');
                    tempDiv.textContent = message;
                    msgDiv.innerHTML = tempDiv.innerHTML;
                }
            } else {
                currentBotMessageElement = null;
                const tempDiv = document.createElement('div');
                tempDiv.textContent = message;
                msgDiv.innerHTML = tempDiv.innerHTML;
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
        if (spinner) {
            spinner.remove();
        }
    }

    async function loadHistory() {
        if (!chatbox) return;
        
        chatbox.innerHTML = "";
        appendMessage("bot", "Cargando conversación...");

        try {
            const response = await fetch(`${apiEndpoint}/history/${userName}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `Error al cargar historial: ${response.status}`;
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.detail) errorMessage += `: ${errorJson.detail}`;
                } catch (e) {
                    errorMessage += `: ${errorText.substring(0, 100)}...`;
                }
                chatbox.innerHTML = "";
                appendMessage("bot", errorMessage);
                return;
            }

            const history = await response.json();
            chatbox.innerHTML = "";

            if (!Array.isArray(history) || history.length === 0) {
                appendMessage("bot", "¡Hola! ¿En qué puedo ayudarte hoy?");
                return;
            }

            history.forEach(msg => {
                if (msg && msg.role && msg.content) {
                    const sender = msg.role === "user" ? "user" : "bot";
                    appendMessage(sender, msg.content);
                }
            });

            chatbox.scrollTop = chatbox.scrollHeight;

        } catch (error) {
            console.error('Error fetching history:', error);
            chatbox.innerHTML = "";
            appendMessage("bot", "¡Hola! ¿En qué puedo ayudarte hoy?");
        }
    }

    async function sendMessage() {
        if (!userQueryTextarea || !userQueryTextarea.value.trim()) return;

        const userQuery = userQueryTextarea.value.trim();
        appendMessage("user", userQuery);
        userQueryTextarea.value = "";
        resizeTextarea();
        userQueryTextarea.focus();

        showSpinner();
        currentBotMessageElement = null;

        try {
            const response = await fetch(`${apiEndpoint}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({
                    userName: userName,
                    message: userQuery
                })
            });

            if (!response.ok) {
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
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let done = false;
            
            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                const chunkValue = decoder.decode(value);
                appendMessage("bot", chunkValue, true);
            }

        } catch (error) {
            console.error("Error en sendMessage:", error);
            appendMessage("bot", "Hubo un problema al enviar el mensaje. Intenta nuevamente.");
        } finally {
            hideSpinner();
        }
    }

    function showDeleteConfirmation() {
        if (modalOverlay) {
            modalOverlay.classList.remove('hidden');
        }
    }

    function hideDeleteConfirmation() {
        if (modalOverlay) {
            modalOverlay.classList.add('hidden');
        }
    }

    async function deleteHistory() {
        try {
            const response = await fetch(`${apiEndpoint}/history/${userName}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                if (chatbox) {
                    chatbox.innerHTML = '';
                    appendMessage("bot", "¡Hola! ¿En qué puedo ayudarte hoy?");
                }
            } else {
                const error = await response.json();
                alert(`Error al borrar historial: ${error.detail}`);
            }
        } catch (error) {
            console.error("Error deleting history:", error);
            alert("Error al borrar historial");
        } finally {
            hideDeleteConfirmation();
        }
    }

    // Event listeners
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

    if (deleteHistoryBtn) {
        deleteHistoryBtn.addEventListener('click', showDeleteConfirmation);
    }

    if (cancelButton) {
        cancelButton.addEventListener('click', hideDeleteConfirmation);
    }

    if (confirmButton) {
        confirmButton.addEventListener('click', deleteHistory);
    }

    // Focus en el textarea al cargar
    if (userQueryTextarea) {
        userQueryTextarea.focus();
    }
});