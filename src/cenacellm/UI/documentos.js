document.addEventListener('DOMContentLoaded', () => {
    const apiEndpoint = "http://localhost:8000";
    const documentUploadInput = document.getElementById('documentUploadInput');
    const uploadDocumentBtn = document.getElementById('uploadDocumentBtn');
    const uploadStatusDiv = document.getElementById('uploadStatus');
    const documentListUl = document.getElementById('documentList');
    const refreshDocumentsBtn = document.getElementById('refreshDocumentsBtn');
    const processDocumentsBtn = document.getElementById('processDocumentsBtn');
    const processStatusDiv = document.getElementById('processStatus');

    // Variable para almacenar los datos completos de los documentos
    let allDocumentsData = {};

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
                fetchAndDisplayDocuments(); // Llama a la función para actualizar la lista después de subir
                documentUploadInput.value = ''; // Limpiar el input de archivo
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

        documentListUl.innerHTML = '<li>Cargando documentos...</li>'; // Mostrar estado de carga
        allDocumentsData = {}; // Limpiar datos previos

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
            documentListUl.innerHTML = ''; // Limpiar la lista actual
            allDocumentsData = documents; // Almacenar los datos completos

            // Modificación para manejar la respuesta como un objeto (diccionario)
            if (typeof documents === 'object' && documents !== null && Object.keys(documents).length > 0) {
                const filenames = Object.keys(documents); // Obtener las claves (nombres de archivo)
                filenames.forEach(filename => {
                    const li = document.createElement('li');
                    li.textContent = filename; // Usar el nombre del archivo como texto
                    li.dataset.filename = filename; // Guardar el nombre del archivo en un data attribute
                    li.classList.add('document-item'); // Añadir clase para identificar elementos de documento
                    documentListUl.appendChild(li);
                });
            } else {
                // Si no es un objeto válido o está vacío
                documentListUl.innerHTML = '<li>No se encontraron documentos.</li>';
            }

        } catch (error) {
            console.error("Error fetching documents:", error);
            documentListUl.innerHTML = `<li>Error de red al cargar documentos: ${error.message}</li>`;
        }
    }

    async function processDocuments() {
        // Mostrar mensaje de inicio de procesamiento
        showStatus(processStatusDiv, "Iniciando procesamiento de documentos...", '');
        processDocumentsBtn.disabled = true; // Deshabilitar botón mientras procesa

        try {
            // Asegúrate de que la colección 'documentos' es correcta si usas una diferente
            const response = await fetch(`${apiEndpoint}/load_documents?collection_name=documentos&force_reload=false`, {
                method: 'POST'
            });

            const result = await response.json();

            if (response.ok) {
                // Esperamos que result sea una lista [docs_count, new_docs_count, chunks_count]
                if (Array.isArray(result) && result.length === 3) {
                    const [docs_count, new_docs_count, chunks_count] = result;
                    // Construir mensaje de éxito detallado
                    const successMessage = `Procesamiento completado. Total: ${docs_count} documentos (${new_docs_count} nuevos/modificados), generando ${chunks_count} chunks.`;
                    showStatus(processStatusDiv, successMessage, 'success');
                } else {
                    // Si la respuesta no tiene el formato esperado
                     showStatus(processStatusDiv, `Procesamiento completado. Respuesta del servidor: ${JSON.stringify(result)}`, 'success');
                }

            } else {
                showStatus(processStatusDiv, `Error al procesar documentos: ${result.detail || response.statusText}`, 'error');
            }

        } catch (error) {
            console.error("Error processing documents:", error);
            showStatus(processStatusDiv, `Error de red al procesar documentos: ${error.message}`, 'error');
        } finally {
            processDocumentsBtn.disabled = false; // Habilitar botón al finalizar (éxito o error)
        }
    }

    function showStatus(element, message, type) {
        if (element) {
            element.textContent = message;
            // Limpiar clases de estado previas y añadir la nueva
            element.className = 'status-message';
            if (type) {
                element.classList.add(type);
            }
        }
    }

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

    // Event listener para mostrar/ocultar detalles al hacer clic en un elemento de la lista
    if (documentListUl) {
        documentListUl.addEventListener('click', (event) => {
            const clickedItem = event.target.closest('.document-item'); // Asegurarse de que se hizo clic en un li.document-item

            if (clickedItem) {
                const filename = clickedItem.dataset.filename;
                const detailsDiv = clickedItem.querySelector('.document-details'); // Buscar si ya existe el div de detalles

                if (detailsDiv) {
                    // Si ya existe, simplemente alternar su visibilidad
                    detailsDiv.classList.toggle('visible');
                } else {
                    // Si no existe, crearlo y añadir los detalles
                    const documentData = allDocumentsData[filename];

                    if (documentData) {
                        const newDetailsDiv = document.createElement('div');
                        newDetailsDiv.classList.add('document-details'); // Clase para estilizar y ocultar/mostrar

                        // Formatear la fecha de procesamiento si existe
                        const processedAt = documentData.processed_at ? new Date(documentData.processed_at).toLocaleString() : 'N/A';

                        newDetailsDiv.innerHTML = `
                            <p><strong>Última modificación:</strong> ${formatTimestamp(documentData.last_modified)}</p>
                            <p><strong>Tamaño:</strong> ${formatBytes(documentData.size)}</p>
                            <p><strong>Procesado en:</strong> ${processedAt}</p>
                            <p><strong>Fragmentos:</strong> ${documentData.chunks}</p>
                        `;

                        clickedItem.appendChild(newDetailsDiv);
                        // Mostrar los detalles recién creados
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

    // Cargar la lista de documentos al cargar la página
    fetchAndDisplayDocuments();
});
