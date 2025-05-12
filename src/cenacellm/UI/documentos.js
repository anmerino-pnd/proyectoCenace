document.addEventListener('DOMContentLoaded', () => {
    const apiEndpoint = "http://localhost:8000";
    const documentUploadInput = document.getElementById('documentUploadInput');
    const uploadDocumentBtn = document.getElementById('uploadDocumentBtn');
    const uploadStatusDiv = document.getElementById('uploadStatus');
    const documentListUl = document.getElementById('documentList');
    const refreshDocumentsBtn = document.getElementById('refreshDocumentsBtn');
    const processDocumentsBtn = document.getElementById('processDocumentsBtn');
    const processStatusDiv = document.getElementById('processStatus');

    async function uploadDocument() {
        if (!documentUploadInput || documentUploadInput.files.length === 0) {
            showStatus(uploadStatusDiv, "Por favor, selecciona un archivo PDF.", 'error');
            return;
        }

        const file = documentUploadInput.files[0];
        const formData = new FormData();
        formData.append('file', file);

        showStatus(uploadStatusDiv, "Subiendo archivo...", '');

        try {
            const response = await fetch(`${apiEndpoint}/upload_document`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                showStatus(uploadStatusDiv, `Archivo subido: ${result.filename}`, 'success');
                fetchAndDisplayDocuments();
                documentUploadInput.value = '';
            } else {
                showStatus(uploadStatusDiv, `Error al subir archivo: ${result.detail || response.statusText}`, 'error');
            }
        } catch (error) {
            console.error("Error uploading document:", error);
            showStatus(uploadStatusDiv, `Error de red al subir archivo: ${error.message}`, 'error');
        }
    }

    async function fetchAndDisplayDocuments() {
        if (!documentListUl) return;

        documentListUl.innerHTML = '<li>Cargando documentos...</li>';

        try {
            const response = await fetch(`${apiEndpoint}/documents`);

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `Error al cargar la lista de documentos: ${response.status}`;
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.detail) errorMessage += `: ${errorJson.detail}`;
                } catch (e) {
                    errorMessage += `: ${errorText.substring(0,100)}...`;
                }
                documentListUl.innerHTML = `<li>${errorMessage}</li>`;
                return;
            }

            const documents = await response.json();
            documentListUl.innerHTML = '';

            if (!Array.isArray(documents) || documents.length === 0) {
                documentListUl.innerHTML = '<li>No se encontraron documentos.</li>';
            } else {
                documents.forEach(doc => {
                    const li = document.createElement('li');
                    li.textContent = doc.filename || doc;
                    documentListUl.appendChild(li);
                });
            }
        } catch (error) {
            console.error("Error fetching documents:", error);
            documentListUl.innerHTML = `<li>Error de red al cargar documentos: ${error.message}</li>`;
        }
    }

    async function processDocuments() {
        showStatus(processStatusDiv, "Procesando documentos...", '');
        try {
            const response = await fetch(`${apiEndpoint}/load_documents?collection_name=documentos&force_reload=false`, {
                method: 'POST'
            });

            const result = await response.json();

            if (response.ok) {
                showStatus(processStatusDiv, `Procesamiento completado: ${result.message}`, 'success');
            } else {
                showStatus(processStatusDiv, `Error al procesar documentos: ${result.detail || response.statusText}`, 'error');
            }

        } catch (error) {
            console.error("Error processing documents:", error);
            showStatus(processStatusDiv, `Error de red al procesar documentos: ${error.message}`, 'error');
        }
    }

    function showStatus(element, message, type) {
        if (element) {
            element.textContent = message;
            element.className = 'status-message';
            if (type) {
                element.classList.add(type);
            }
        }
    }

    if (uploadDocumentBtn) uploadDocumentBtn.addEventListener('click', uploadDocument);
    if (refreshDocumentsBtn) refreshDocumentsBtn.addEventListener('click', fetchAndDisplayDocuments);
    if (processDocumentsBtn) processDocumentsBtn.addEventListener('click', processDocuments);
});