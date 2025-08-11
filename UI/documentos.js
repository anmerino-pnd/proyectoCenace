document.addEventListener('DOMContentLoaded', () => {
    // const apiEndpoint = "http://localhost:8000";
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

    // Modified showStatus function to include a spinner
    function showStatus(element, message, type, showSpinner = false) {
        if (element) {
            // Clear existing content and classes
            element.innerHTML = '';
            element.className = 'status-message'; // Reset to base class

            if (type) {
                element.classList.add(type);
            }

            if (showSpinner) {
                element.classList.add('loading'); // Add 'loading' class for flexbox styles
                const spinner = document.createElement('div');
                spinner.classList.add('loading-spinner'); // Add the CSS spinner class

                element.appendChild(spinner); // Add the spinner to the element
                const textNode = document.createTextNode(message);
                element.appendChild(textNode); // Add the message text
            } else {
                element.textContent = message; // Just show the message if no spinner
            }
        }
    }

    async function uploadDocument() {
        if (!documentUploadInput || documentUploadInput.files.length === 0) {
            showStatus(uploadStatusDiv, "Por favor, selecciona al menos un archivo para subir.", 'error');
            return;
        }

        const files = documentUploadInput.files;
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }

        // Use the updated showStatus function with spinner
        showStatus(uploadStatusDiv, 'Subiendo archivos...', '', true);
        uploadDocumentBtn.disabled = true;

        try {
            const response = await fetch(`${window.API_ENDPOINT}/upload_documents`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                showStatus(uploadStatusDiv, `Archivos subidos exitosamente: ${result.files.map(f => f.filename).join(', ')}`, 'success');
                // Consider calling fetchAndDisplayDocuments here to refresh the list
                fetchAndDisplayDocuments();
                documentUploadInput.value = ''; // Clear input
                selectedFilesPreviewDiv.innerHTML = ''; // Clear preview
                selectedFilesPreviewDiv.style.display = 'none'; // Hide preview
            } else {
                showStatus(uploadStatusDiv, `Error al subir archivos: ${result.detail || response.statusText}`, 'error');
            }
        } catch (error) {
            console.error("Error al subir archivos:", error);
            showStatus(uploadStatusDiv, `Error de red al subir archivos: ${error.message}`, 'error');
        } finally {
            uploadDocumentBtn.disabled = false;
        }
    }

    async function fetchAndDisplayDocuments() {
        if (!documentListUl) return;
        documentListUl.innerHTML = '<li>Cargando documentos...</li>';
        try {
            const response = await fetch(`${window.API_ENDPOINT}/documents`);
            if (!response.ok) {
                const errorText = await response.text();
                documentListUl.innerHTML = `<li>Error al cargar documentos: ${response.status} - ${errorText}</li>`;
                console.error("Error fetching documents:", errorText);
                return;
            }

            const documents = await response.json();
            allDocumentsData = documents; // Store the full data including reference IDs
            documentListUl.innerHTML = ''; // Clear loading message

            if (Object.keys(documents).length === 0) {
                documentListUl.innerHTML = '<li>No hay documentos disponibles.</li>';
                return;
            }

            for (const filename in documents) {
                const documentData = documents[filename];
                const listItem = document.createElement('li');
                listItem.classList.add('document-item');
                // Add the selection-active class if mode is active for immediate styling
                if (isSelectionMode) {
                    listItem.classList.add('selection-active');
                }


                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.classList.add('custom-checkbox'); // Use the generic custom-checkbox class
                checkbox.dataset.referenceId = documentData.reference; // Store the reference ID

                const contentWrapper = document.createElement('div');
                contentWrapper.classList.add('document-item-content'); // New wrapper for content

                const filenameSpan = document.createElement('span');
                filenameSpan.classList.add('document-filename');
                filenameSpan.textContent = filename;
                contentWrapper.appendChild(filenameSpan);

                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('document-details', 'hidden'); // Initially hidden

                // Populate details (these are examples, adjust based on your actual metadata)
                const processedAt = documentData.processed_at ? formatTimestamp(new Date(documentData.processed_at)) : 'N/A';
                detailsDiv.innerHTML = `
                    <p><strong>Referencia:</strong> ${documentData.reference || 'N/A'}</p>
                    <p><strong>Última Modificación:</strong> ${formatTimestamp(documentData.last_modified)}</p>
                    <p><strong>Tamaño:</strong> ${formatBytes(documentData.size)}</p>
                    <p><strong>Procesado en:</strong> ${processedAt}</p>
                    <p><strong>Fragmentos:</strong> ${documentData.chunks}</p>
                `;

                contentWrapper.appendChild(detailsDiv);

                listItem.appendChild(checkbox);
                listItem.appendChild(contentWrapper); // Append the wrapper

                listItem.addEventListener('click', (event) => {
                    // Si el click fue en el checkbox, no hacer nada más que la acción del checkbox
                    if (event.target === checkbox) {
                        return;
                    }

                    if (isSelectionMode) {
                        checkbox.checked = !checkbox.checked;
                        if (checkbox.checked) {
                            if (!selectedDocumentsToDelete.includes(documentData.reference)) {
                                selectedDocumentsToDelete.push(documentData.reference);
                            }
                        } else {
                            selectedDocumentsToDelete = selectedDocumentsToDelete.filter(id => id !== documentData.reference);
                        }
                        updateDeleteButtonState();
                    } else {
                        // Toggle visibility of details
                        detailsDiv.classList.toggle('hidden');
                        detailsDiv.classList.toggle('visible');
                    }
                });

                listItem.addEventListener('change', (event) => {
                    if (event.target === checkbox) {
                        if (checkbox.checked) {
                            if (!selectedDocumentsToDelete.includes(documentData.reference)) {
                                selectedDocumentsToDelete.push(documentData.reference);
                            }
                        } else {
                            selectedDocumentsToDelete = selectedDocumentsToDelete.filter(id => id !== documentData.reference);
                        }
                        updateDeleteButtonState();
                    }
                });


                documentListUl.appendChild(listItem);
            }
            updateDeleteButtonState(); // Update button state after loading documents
        } catch (error) {
            console.error("Error al cargar documentos:", error);
            documentListUl.innerHTML = '<li>Hubo un problema al cargar los documentos.</li>';
        }
    }

    async function processDocuments() {
        // Use the updated showStatus function with spinner
        showStatus(processStatusDiv, 'Procesando documentos...', '', true);
        processDocumentsBtn.disabled = true;

        try {
            // Actualmente se procesan todos los documentos en la carpeta DOCUMENTS_DIR
            // Aquí puedes añadir lógica para seleccionar qué colección procesar si lo deseas.
            const collectionName = "documentos"; // O puedes hacer esto seleccionable en la UI
            const response = await fetch(`${window.API_ENDPOINT}/load_documents?collection_name=${collectionName}&force_reload=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();

            if (response.ok) {
                showStatus(processStatusDiv, `Procesamiento completado. Documentos: ${result[0]}, Nuevos: ${result[1]}, Chunks: ${result[2]}`, 'success');
                fetchAndDisplayDocuments(); // Refresh the list to reflect processed state
            } else {
                showStatus(processStatusDiv, `Error al procesar documentos: ${result.detail || response.statusText}`, 'error');
            }
        } catch (error) {
            console.error("Error al procesar documentos:", error);
            showStatus(processStatusDiv, `Error de red al procesar documentos: ${error.message}`, 'error');
        } finally {
            processDocumentsBtn.disabled = false;
        }
    }

    function updateSelectionModeUI() {
        if (isSelectionMode) {
            documentListContainer.classList.add('selection-active'); // Add class to main container
            toggleSelectionModeBtn.textContent = "Cancelar Selección";
            deleteSelectedDocumentsBtn.classList.remove('hidden');
            deleteSelectedDocumentsBtn.textContent = "Eliminar Documentos Seleccionados";
            deleteSelectedDocumentsBtn.disabled = true; // Disable initially
            selectedDocumentsToDelete = []; // Clear selection when entering mode
            // Ensure all checkboxes are unchecked when entering selection mode
            document.querySelectorAll('.document-item .custom-checkbox').forEach(checkbox => checkbox.checked = false);
        } else {
            documentListContainer.classList.remove('selection-active'); // Remove class
            toggleSelectionModeBtn.textContent = "Eliminar Documentos";
            deleteSelectedDocumentsBtn.classList.add('hidden');
            selectedDocumentsToDelete = [];
            // Uncheck all checkboxes visually
            document.querySelectorAll('.document-item .custom-checkbox').forEach(checkbox => checkbox.checked = false);
        }
        showStatus(deleteStatusDiv, '', ''); // Clear status message
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

    async function deleteSelectedDocuments() {
        if (selectedDocumentsToDelete.length === 0) {
            showStatus(deleteStatusDiv, "Por favor, selecciona los documentos a eliminar.", 'error');
            return;
        }

        showStatus(deleteStatusDiv, "Eliminando documentos...", '');
        deleteSelectedDocumentsBtn.disabled = true;
        toggleSelectionModeBtn.disabled = true;

        try {
            const response = await fetch(`${window.API_ENDPOINT}/delete_document`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reference_ids: selectedDocumentsToDelete }) // Send as reference_ids
            });

            const result = await response.json();

            if (response.ok) {
                showStatus(deleteStatusDiv, `Documentos eliminados exitosamente.`, 'success');
                isSelectionMode = false; // Exit selection mode
                fetchAndDisplayDocuments(); // Reload the list
            } else {
                console.error("Delete response:", result);
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


    if (documentUploadInput) {
        documentUploadInput.addEventListener('change', () => {
            if (documentUploadInput.files.length > 0) {
                const fileNames = Array.from(documentUploadInput.files).map(file => file.name).join(', ');
                selectedFilesPreviewDiv.textContent = `Archivos seleccionados: ${fileNames}`;
                selectedFilesPreviewDiv.style.display = 'block';
            } else {
                selectedFilesPreviewDiv.textContent = '';
                selectedFilesPreviewDiv.style.display = 'none';
            }
        });
    }

    if (toggleSelectionModeBtn) {
        toggleSelectionModeBtn.addEventListener('click', () => {
            isSelectionMode = !isSelectionMode;
            updateSelectionModeUI();
            if (isSelectionMode) {
                showStatus(deleteStatusDiv, '', ''); // Clear status when entering selection mode
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
        // Asegúrate de que el timestamp es en milisegundos para Date si viene de JS Date.now()
        // Si viene de Python datetime.now().isoformat() y luego new Date(iso_string), ya es correcto.
        // Si es un UNIX timestamp (segundos), multiplica por 1000:
        const date = typeof timestamp === 'number' && timestamp.toString().length === 10 ? new Date(timestamp * 1000) : new Date(timestamp);

        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        };
        return date.toLocaleDateString('es-ES', options);
    }

    // Initial fetch when document tab is potentially loaded (or first accessed)
    fetchAndDisplayDocuments(); // This will load when the script loads
});
