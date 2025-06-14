document.addEventListener('DOMContentLoaded', () => {
    const apiEndpoint = "http://localhost:8000";
    const documentUploadInput = document.getElementById('documentUploadInput');
    const uploadDocumentBtn = document.getElementById('uploadDocumentBtn');
    const uploadStatusDiv = document.getElementById('uploadStatus');
    const documentListUl = document.getElementById('documentList');
    const refreshDocumentsBtn = document.getElementById('refreshDocumentsBtn');
    const processDocumentsBtn = document.getElementById('processDocumentsBtn');
    const processStatusDiv = document.getElementById('processStatus');
    const selectedFilesPreviewDiv = document.getElementById('selectedFilesPreview');

    const toggleSelectionModeBtn = document.getElementById('toggleSelectionModeBtn');
    const deleteSelectedDocumentsBtn = document.getElementById('deleteSelectedDocumentsBtn');
    const deleteStatusDiv = document.getElementById('deleteStatus');
    const documentListContainer = document.getElementById('documentListContainer');

    let allDocumentsData = {}; // Stores document data keyed by filename, including the 'reference' (UUID)
    let selectedDocumentsToDelete = []; // This will now store reference_ids (UUIDs)
    let isSelectionMode = false;

    function showStatus(element, message, type) {
        if (element) {
            element.textContent = message;
            element.className = 'status-message';
            if (type) {
                element.classList.add(type);
            }
        }
    }

    function updateSelectedFilesPreview() {
        if (selectedFilesPreviewDiv && documentUploadInput && documentUploadInput.files) {
            const files = documentUploadInput.files;
            if (files.length > 0) {
                let previewText = 'Archivos seleccionados: ';
                for (let i = 0; i < files.length; i++) {
                    previewText += files[i].name;
                    if (i < files.length - 1) {
                        previewText += ', ';
                    }
                }
                selectedFilesPreviewDiv.textContent = previewText;
                selectedFilesPreviewDiv.style.display = 'block';
            } else {
                selectedFilesPreviewDiv.textContent = '';
                selectedFilesPreviewDiv.style.display = 'none';
            }
        }
    }

    if (documentUploadInput) {
        documentUploadInput.addEventListener('change', updateSelectedFilesPreview);
    }

    async function uploadDocument() {
        if (!documentUploadInput || documentUploadInput.files.length === 0) {
            showStatus(uploadStatusDiv, "Por favor, selecciona al menos un archivo PDF.", 'error');
            return;
        }

        const files = documentUploadInput.files;
        const formData = new FormData();

        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }

        showStatus(uploadStatusDiv, "Subiendo archivo(s)...", '');

        try {
            const response = await fetch(`${apiEndpoint}/upload_documents`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                showStatus(uploadStatusDiv, `Archivos subidos exitosamente.`, 'success');
                fetchAndDisplayDocuments();
                documentUploadInput.value = '';
                updateSelectedFilesPreview();
            } else {
                showStatus(uploadStatusDiv, `Error al subir archivo(s): ${result.detail || response.statusText}`, 'error');
            }
        } catch (error) {
            console.error("Error uploading document(s):", error);
            showStatus(uploadStatusDiv, `Error de red al subir archivo(s): ${error.message}`, 'error');
        }
    }

    async function fetchAndDisplayDocuments() {
        if (!documentListUl) return;

        documentListUl.innerHTML = '<li>Cargando documentos...</li>';
        allDocumentsData = {}; // Clear previous data
        selectedDocumentsToDelete = []; // Clear selected items
        isSelectionMode = false; // Reset selection mode
        updateSelectionModeUI(); // Update UI accordingly

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
            allDocumentsData = documents; // Store all document data

            if (typeof documents === 'object' && documents !== null && Object.keys(documents).length > 0) {
                const filenames = Object.keys(documents);
                filenames.forEach(filename => {
                    const documentData = documents[filename]; // Get the full document data
                    const li = document.createElement('li');
                    li.classList.add('document-item');

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.classList.add('document-checkbox');
                    checkbox.dataset.referenceId = documentData.reference; // Store the actual reference ID (UUID)
                    checkbox.dataset.filename = filename; // Keep filename for display

                    const filenameSpan = document.createElement('span');
                    filenameSpan.textContent = filename;
                    filenameSpan.classList.add('document-filename');

                    li.appendChild(checkbox);
                    li.appendChild(filenameSpan);

                    li.dataset.filename = filename; // Store filename on li
                    li.dataset.referenceId = documentData.reference; // Store reference ID on li for detail display

                    documentListUl.appendChild(li);
                });
            } else {
                documentListUl.innerHTML = '<li>No se encontraron documentos.</li>';
            }

        } catch (error) {
            console.error("Error fetching documents:", error);
            documentListUl.innerHTML = `<li>Error de red al cargar documentos: ${error.message}</li>`;
        }
    }

    async function processDocuments() {
        showStatus(processStatusDiv, "Iniciando procesamiento de documentos...", '');
        processDocumentsBtn.disabled = true;

        try {
            const response = await fetch(`${apiEndpoint}/load_documents?collection_name=documentos&force_reload=false`, {
                method: 'POST'
            });

            const result = await response.json();

            if (response.ok) {
                if (Array.isArray(result) && result.length === 3) {
                    const [docs_count, new_docs_count, chunks_count] = result;
                    const successMessage = `Procesamiento completado. Total: ${docs_count} documentos (${new_docs_count} nuevos/modificados), generando ${chunks_count} chunks.`;
                    showStatus(processStatusDiv, successMessage, 'success');
                } else {
                     showStatus(processStatusDiv, `Procesamiento completado. Respuesta del servidor: ${JSON.stringify(result)}`, 'success');
                }

            } else {
                showStatus(processStatusDiv, `Error al procesar documentos: ${result.detail || response.statusText}`, 'error');
            }

        } catch (error) {
            console.error("Error processing documents:", error);
            showStatus(processStatusDiv, `Error de red al procesar documentos: ${error.message}`, 'error');
        } finally {
            processDocumentsBtn.disabled = false;
        }
    }

    function updateSelectionModeUI() {
        if (isSelectionMode) {
            documentListContainer.classList.add('selection-active');
            toggleSelectionModeBtn.textContent = "Cancelar Selección";
            deleteSelectedDocumentsBtn.classList.remove('hidden'); // Show delete button
            deleteSelectedDocumentsBtn.textContent = "Eliminar Documentos Seleccionados";
            deleteSelectedDocumentsBtn.disabled = true; // Disable delete button initially
        } else {
            documentListContainer.classList.remove('selection-active');
            toggleSelectionModeBtn.textContent = "Eliminar Documentos";
            deleteSelectedDocumentsBtn.classList.add('hidden'); // Hide delete button
            selectedDocumentsToDelete = []; // Clear selected items
            document.querySelectorAll('.document-checkbox').forEach(checkbox => checkbox.checked = false);
        }
         showStatus(deleteStatusDiv, '', ''); // Clear status message
    }

    async function deleteSelectedDocuments() {
        if (selectedDocumentsToDelete.length === 0) {
            showStatus(deleteStatusDiv, "Por favor, selecciona los documentos a eliminar.", 'error');
            return;
        }

        showStatus(deleteStatusDiv, "Eliminando documentos...", '');
        deleteSelectedDocumentsBtn.disabled = true;
        toggleSelectionModeBtn.disabled = true;

        try {
            const response = await fetch(`${apiEndpoint}/delete_document`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                // CORRECTED LINE: Send an object with 'reference_ids' key
                body: JSON.stringify({ reference_ids: selectedDocumentsToDelete })
            });

            const result = await response.json();

            if (response.ok) {
                 showStatus(deleteStatusDiv, `Documentos eliminados exitosamente.`, 'success');
                 isSelectionMode = false; // Exit selection mode
                 fetchAndDisplayDocuments(); // Reload the list
            } else {
                console.error("Delete response:", result); // Log the full error response from server
                showStatus(deleteStatusDiv, `Error al eliminar documentos: ${result.detail || response.statusText}`, 'error');
            }

        } catch (error) {
            console.error("Error deleting documents:", error);
            showStatus(deleteStatusDiv, `Error de red al eliminar documentos: ${error.message}`, 'error');
        } finally {
            deleteSelectedDocumentsBtn.disabled = false;
            toggleSelectionModeBtn.disabled = false;
             if (deleteStatusDiv && deleteStatusDiv.classList.contains('success')) {
                // If deletion was successful, the UI will be reset by fetchAndDisplayDocuments
             } else {
                 updateDeleteButtonState(); // Otherwise, update button state
             }
        }
    }

    function updateDeleteButtonState() {
        if (isSelectionMode && deleteSelectedDocumentsBtn) {
            if (selectedDocumentsToDelete.length > 0) {
                deleteSelectedDocumentsBtn.textContent = `Eliminar Documentos Seleccionados (${selectedDocumentsToDelete.length})`;
                deleteSelectedDocumentsBtn.disabled = false;
                deleteSelectedDocumentsBtn.classList.remove('hidden');
            } else {
                deleteSelectedDocumentsBtn.textContent = "Eliminar Documentos Seleccionados";
                deleteSelectedDocumentsBtn.disabled = true;
                deleteSelectedDocumentsBtn.classList.add('hidden');
            }
        } else {
             deleteSelectedDocumentsBtn.classList.add('hidden');
        }
    }

    if (toggleSelectionModeBtn) {
        toggleSelectionModeBtn.addEventListener('click', () => {
            isSelectionMode = !isSelectionMode;
            updateSelectionModeUI();
            if (isSelectionMode) {
                 showStatus(deleteStatusDiv, '', '');
            }
        });
    }

    if (documentListUl) {
        documentListUl.addEventListener('change', (event) => {
            if (isSelectionMode && event.target.classList.contains('document-checkbox')) {
                const checkbox = event.target;
                const referenceId = checkbox.dataset.referenceId; // Get the reference ID

                if (checkbox.checked) {
                    if (!selectedDocumentsToDelete.includes(referenceId)) {
                        selectedDocumentsToDelete.push(referenceId);
                    }
                } else {
                    selectedDocumentsToDelete = selectedDocumentsToDelete.filter(id => id !== referenceId);
                }
                updateDeleteButtonState();
            }
        });

        documentListUl.addEventListener('click', (event) => {
            const clickedItem = event.target.closest('.document-item');
            // Asegurarse de que el clic no sea en el checkbox ni en el enlace de la fuente
            if (clickedItem && !isSelectionMode && !event.target.classList.contains('document-checkbox') && !event.target.classList.contains('document-source-link')) {
                const filename = clickedItem.dataset.filename;
                let detailsDiv = clickedItem.querySelector('.document-details');

                if (detailsDiv) {
                    detailsDiv.classList.toggle('visible');
                } else {
                    const documentData = allDocumentsData[filename];
                    if (documentData) {
                        detailsDiv = document.createElement('div');
                        detailsDiv.classList.add('document-details');

                        const processedAt = documentData.processed_at ? new Date(documentData.processed_at).toLocaleString() : 'N/A';

                        // Extraer solo el nombre del archivo de la ruta completa para el enlace
                        const sourcePath = documentData.source;
                        const sourceFilename = sourcePath ? sourcePath.split(/[\\/]/).pop() : 'N/A'; // Manejar rutas de Windows y Unix

                        detailsDiv.innerHTML = `
                            <p><strong>Fuente:</strong> <a href="${apiEndpoint}/view_document/${encodeURIComponent(sourceFilename)}" target="_blank" class="document-source-link">${sourceFilename}</a></p>
                            <p><strong>Última modificación:</strong> ${formatTimestamp(documentData.last_modified)}</p>
                            <p><strong>Tamaño:</strong> ${formatBytes(documentData.size)}</p>
                            <p><strong>Procesado en:</strong> ${processedAt}</p>
                            <p><strong>Fragmentos:</strong> ${documentData.chunks}</p>
                        `;
                        clickedItem.appendChild(detailsDiv);
                        detailsDiv.classList.add('visible');
                    }
                }
            }
        });
    }

    if (uploadDocumentBtn) uploadDocumentBtn.addEventListener('click', uploadDocument);
    if (refreshDocumentsBtn) refreshDocumentsBtn.addEventListener('click', fetchAndDisplayDocuments);
    if (processDocumentsBtn) processDocumentsBtn.addEventListener('click', processDocuments);
    if (deleteSelectedDocumentsBtn) deleteSelectedDocumentsBtn.addEventListener('click', deleteSelectedDocuments);

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function formatTimestamp(timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    }

    fetchAndDisplayDocuments();
});
    