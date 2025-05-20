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

    // Referencias a los nuevos elementos y el botón de eliminar existente
    const toggleSelectionModeBtn = document.getElementById('toggleSelectionModeBtn'); // Botón para activar/desactivar selección
    const deleteSelectedDocumentsBtn = document.getElementById('deleteSelectedDocumentsBtn'); // Botón de eliminar (ahora su visibilidad y texto cambian)
    const deleteStatusDiv = document.getElementById('deleteStatus');
    const documentListContainer = document.getElementById('documentListContainer'); // Contenedor de la lista para controlar checkboxes

    // Variable para almacenar los datos completos de los documentos
    let allDocumentsData = {};
    // Variable para almacenar los nombres de los documentos seleccionados para eliminar
    let selectedDocumentsToDelete = [];
    // Variable para controlar si estamos en modo de selección
    let isSelectionMode = false;


    // Función para mostrar el estado (éxito, error, etc.)
    function showStatus(element, message, type) {
        if (element) {
            element.textContent = message;
            element.className = 'status-message'; // Reset classes
            if (type) {
                element.classList.add(type);
            }
        }
    }

    // Función para actualizar la previsualización de archivos seleccionados
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
                selectedFilesPreviewDiv.style.display = 'block'; // Mostrar el div
            } else {
                selectedFilesPreviewDiv.textContent = '';
                selectedFilesPreviewDiv.style.display = 'none'; // Ocultar el div si no hay archivos
            }
        }
    }

    // Event listener para el input de archivo para actualizar la previsualización
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

        // Añadir cada archivo seleccionado al FormData
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]); // Asegúrate de que el nombre del campo ('files') coincide con tu endpoint FastAPI si espera múltiples archivos así
        }


        showStatus(uploadStatusDiv, "Subiendo archivo(s)...", '');

        try {
            const response = await fetch(`${apiEndpoint}/upload_documents`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                // Ajusta este mensaje si la respuesta para múltiples archivos es diferente
                showStatus(uploadStatusDiv, `Archivos subidos exitosamente.`, 'success');
                fetchAndDisplayDocuments(); // Actualizar la lista después de subir
                documentUploadInput.value = ''; // Limpiar el input de archivo
                updateSelectedFilesPreview(); // Limpiar la previsualización
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
        allDocumentsData = {};
        selectedDocumentsToDelete = []; // Limpiar la lista de seleccionados al actualizar
        isSelectionMode = false; // Asegurarse de que no estamos en modo selección al cargar
        updateSelectionModeUI(); // Actualizar la UI para el modo no selección

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
            allDocumentsData = documents;

            if (typeof documents === 'object' && documents !== null && Object.keys(documents).length > 0) {
                const filenames = Object.keys(documents);
                filenames.forEach(filename => {
                    const li = document.createElement('li');
                    li.classList.add('document-item'); // Clase para identificar elementos de documento

                    // Crear checkbox (inicialmente oculto por CSS)
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.classList.add('document-checkbox');
                    checkbox.dataset.filename = filename; // Asociar filename al checkbox

                    // Crear span para el nombre del archivo
                    const filenameSpan = document.createElement('span');
                    filenameSpan.textContent = filename;
                    filenameSpan.classList.add('document-filename');

                    // Añadir checkbox y nombre al elemento de la lista
                    li.appendChild(checkbox);
                    li.appendChild(filenameSpan);

                    // Guardar el nombre del archivo en un data attribute del li (opcional, ya está en checkbox)
                    li.dataset.filename = filename;


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

    // Función para actualizar la UI según el modo de selección
    function updateSelectionModeUI() {
        if (isSelectionMode) {
            // Modo selección activo
            documentListContainer.classList.add('selection-active');
            toggleSelectionModeBtn.textContent = "Cancelar Selección";
            // El botón de eliminar se mostrará/ocultará en el listener del checkbox
            deleteSelectedDocumentsBtn.classList.add('hidden'); // Ocultar hasta que se seleccione algo
            deleteSelectedDocumentsBtn.textContent = "Eliminar Documentos Seleccionados"; // Resetear texto
            deleteSelectedDocumentsBtn.disabled = true; // Deshabilitar hasta que se seleccione algo
        } else {
            // Modo selección inactivo
            documentListContainer.classList.remove('selection-active');
            toggleSelectionModeBtn.textContent = "Seleccionar Documentos";
            deleteSelectedDocumentsBtn.classList.add('hidden'); // Ocultar botón de eliminar
            selectedDocumentsToDelete = []; // Limpiar selección
            document.querySelectorAll('.document-checkbox').forEach(checkbox => checkbox.checked = false); // Desmarcar checkboxes
        }
         // Limpiar cualquier mensaje de estado de eliminación al cambiar de modo
         showStatus(deleteStatusDiv, '', '');
    }


    // Nueva función para eliminar documentos seleccionados
    async function deleteSelectedDocuments() {
        if (selectedDocumentsToDelete.length === 0) {
            showStatus(deleteStatusDiv, "Por favor, selecciona los documentos a eliminar.", 'error');
            return;
        }

        showStatus(deleteStatusDiv, "Eliminando documentos...", '');
        deleteSelectedDocumentsBtn.disabled = true; // Deshabilitar botón mientras elimina
        toggleSelectionModeBtn.disabled = true; // Deshabilitar botón de modo también

        try {
            const response = await fetch(`${apiEndpoint}/delete_document`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                // Enviar la lista de nombres de archivo en el body como JSON
                body: JSON.stringify(selectedDocumentsToDelete)
            });

            const result = await response.json();

            if (response.ok) {
                // Asumiendo que tu API devuelve un mensaje de éxito o similar
                 showStatus(deleteStatusDiv, `Documentos eliminados exitosamente.`, 'success');
                 // Salir del modo de selección y actualizar la lista
                 isSelectionMode = false;
                 fetchAndDisplayDocuments(); // Esto ya llama a updateSelectionModeUI()
                 // updateSelectionModeUI(); // Llamado por fetchAndDisplayDocuments
            } else {
                showStatus(deleteStatusDiv, `Error al eliminar documentos: ${result.detail || response.statusText}`, 'error');
            }

        } catch (error) {
            console.error("Error deleting documents:", error);
            showStatus(deleteStatusDiv, `Error de red al eliminar documentos: ${error.message}`, 'error');
        } finally {
            deleteSelectedDocumentsBtn.disabled = false; // Habilitar botón al finalizar (aunque se ocultará)
            toggleSelectionModeBtn.disabled = false; // Habilitar botón de modo
             // Si hubo un error, no salimos del modo de selección automáticamente
             if (deleteStatusDiv && deleteStatusDiv.classList.contains('success')) {
                 // Si fue exitoso, fetchAndDisplayDocuments ya manejó la salida del modo
             } else {
                 // Si hubo un error, asegurarnos de que el botón de eliminar refleje la selección actual
                 updateDeleteButtonState();
             }
        }
    }

    // Función para actualizar el texto y estado del botón de eliminar
    function updateDeleteButtonState() {
        if (isSelectionMode && deleteSelectedDocumentsBtn) {
            if (selectedDocumentsToDelete.length > 0) {
                deleteSelectedDocumentsBtn.textContent = `Eliminar Documentos Seleccionados (${selectedDocumentsToDelete.length})`;
                deleteSelectedDocumentsBtn.disabled = false;
                deleteSelectedDocumentsBtn.classList.remove('hidden'); // Mostrar botón de eliminar
            } else {
                deleteSelectedDocumentsBtn.textContent = "Eliminar Documentos Seleccionados";
                deleteSelectedDocumentsBtn.disabled = true;
                deleteSelectedDocumentsBtn.classList.add('hidden'); // Ocultar botón de eliminar si no hay selección
            }
        } else {
             deleteSelectedDocumentsBtn.classList.add('hidden'); // Asegurarse de que esté oculto fuera del modo selección
        }
    }


    // Event listener para el botón de activar/desactivar el modo de selección
    if (toggleSelectionModeBtn) {
        toggleSelectionModeBtn.addEventListener('click', () => {
            isSelectionMode = !isSelectionMode; // Alternar el estado
            updateSelectionModeUI(); // Actualizar la UI
            // Si entramos en modo selección, limpiar cualquier estado de eliminación previo
            if (isSelectionMode) {
                 showStatus(deleteStatusDiv, '', '');
            }
        });
    }


    // Event listener para la lista de documentos (para manejar clics en checkboxes)
    if (documentListUl) {
        documentListUl.addEventListener('change', (event) => {
            // Verificar si el evento proviene de un checkbox y si estamos en modo selección
            if (isSelectionMode && event.target.classList.contains('document-checkbox')) {
                const checkbox = event.target;
                const filename = checkbox.dataset.filename;

                if (checkbox.checked) {
                    // Añadir el nombre del archivo a la lista de seleccionados si no está ya
                    if (!selectedDocumentsToDelete.includes(filename)) {
                        selectedDocumentsToDelete.push(filename);
                    }
                } else {
                    // Eliminar el nombre del archivo de la lista de seleccionados
                    selectedDocumentsToDelete = selectedDocumentsToDelete.filter(name => name !== filename);
                }
                updateDeleteButtonState(); // Actualizar el estado del botón de eliminar
                console.log("Documentos seleccionados para eliminar:", selectedDocumentsToDelete); // Para depuración
            }
             // Lógica existente para mostrar/ocultar detalles (si aún la quieres)
             // Solo permitir mostrar detalles si NO estamos en modo selección
             const clickedItem = event.target.closest('.document-item');
             if (clickedItem && !event.target.classList.contains('document-checkbox') && !isSelectionMode) {
                 const filename = clickedItem.dataset.filename;
                 const detailsDiv = clickedItem.querySelector('.document-details');

                 if (detailsDiv) {
                     detailsDiv.classList.toggle('visible');
                 } else {
                     const documentData = allDocumentsData[filename];
                     if (documentData) {
                         const newDetailsDiv = document.createElement('div');
                         newDetailsDiv.classList.add('document-details');

                         const processedAt = documentData.processed_at ? new Date(documentData.processed_at).toLocaleString() : 'N/A';

                         newDetailsDiv.innerHTML = `
                             <p><strong>Última modificación:</strong> ${formatTimestamp(documentData.last_modified)}</p>
                             <p><strong>Tamaño:</strong> ${formatBytes(documentData.size)}</p>
                             <p><strong>Procesado en:</strong> ${processedAt}</p>
                             <p><strong>Fragmentos:</strong> ${documentData.chunks}</p>
                         `;
                         clickedItem.appendChild(newDetailsDiv);
                         newDetailsDiv.classList.add('visible');
                     }
                 }
             }
        });
    }


    // Event listeners para los botones
    if (uploadDocumentBtn) uploadDocumentBtn.addEventListener('click', uploadDocument);
    if (refreshDocumentsBtn) refreshDocumentsBtn.addEventListener('click', fetchAndDisplayDocuments);
    if (processDocumentsBtn) processDocumentsBtn.addEventListener('click', processDocuments);
    // Event listener para el botón de eliminar
    if (deleteSelectedDocumentsBtn) deleteSelectedDocumentsBtn.addEventListener('click', deleteSelectedDocuments);


    // Función para formatear el tamaño del archivo
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Función para formatear la fecha desde un timestamp UNIX
    function formatTimestamp(timestamp) {
        const date = new Date(timestamp * 1000); // Convertir segundos a milisegundos
        return date.toLocaleString(); // Formato de fecha y hora local
    }


    // Cargar la lista de documentos al cargar la página
    fetchAndDisplayDocuments();
});
