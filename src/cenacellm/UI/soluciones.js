// soluciones.js
document.addEventListener('DOMContentLoaded', () => {
    const likedSolutionsList = document.getElementById('likedSolutionsList');
    const processLikedSolutionsBtn = document.getElementById('processLikedSolutionsBtn');
    const processSolutionsStatusDiv = document.getElementById('processSolutionsStatus');

    // New elements for deletion functionality
    const toggleSolutionSelectionModeBtn = document.getElementById('toggleSolutionSelectionModeBtn');
    const deleteSelectedSolutionsBtn = document.getElementById('deleteSelectedSolutionsBtn');
    const deleteSolutionsStatusDiv = document.getElementById('deleteSolutionsStatus');

    let selectedSolutionsToDelete = [];
    let isSolutionSelectionMode = false;

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
     * Carga y muestra las soluciones "likeadas" en la pestaña de soluciones.
     * Esta función es llamada desde app.js cuando se activa la pestaña de soluciones.
     * @param {string} userName - El nombre de usuario actual.
     * @param {string} apiEndpoint - La URL base del endpoint de la API.
     */
    async function loadLikedSolutions(userName, apiEndpoint) {
        if (!likedSolutionsList || !userName) {
            console.warn("Contenedor de soluciones 'likeadas' o nombre de usuario no disponible.");
            return;
        }

        likedSolutionsList.innerHTML = '<p>Cargando soluciones...</p>'; // Loading message
        selectedSolutionsToDelete = []; // Clear selected solutions
        isSolutionSelectionMode = false; // Reset selection mode
        updateSolutionSelectionModeUI(); // Update UI for selection mode

        try {
            const response = await fetch(`${apiEndpoint}/solutions/${userName}`);
            if (!response.ok) {
                const errorText = await response.text();
                likedSolutionsList.innerHTML = `<p>Error al cargar soluciones: ${response.status} - ${errorText}</p>`;
                console.error("Error fetching liked solutions:", errorText);
                return;
            }

            const solutions = await response.json();
            likedSolutionsList.innerHTML = ''; // Clear loading message

            if (!Array.isArray(solutions) || solutions.length === 0) {
                likedSolutionsList.innerHTML = '<p>No hay soluciones guardadas aún.</p>';
                return;
            }

            solutions.forEach(solution => {
                const solutionItem = document.createElement('div');
                solutionItem.classList.add('solution-item');

                // Checkbox for selection
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.classList.add('solution-checkbox');
                checkbox.dataset.solutionReferenceId = solution.id; // Store the solution's reference ID

                const questionDiv = document.createElement('div');
                questionDiv.classList.add('solution-question');
                // Display user question and a toggle icon
                questionDiv.innerHTML = `<span>${solution.question}</span> <span class="toggle-icon">+</span>`;
                questionDiv.dataset.solutionId = solution.id; // Store solution ID

                const answerDiv = document.createElement('div');
                answerDiv.classList.add('solution-answer', 'hidden');
                // Ensure 'marked' is globally available or import it
                answerDiv.innerHTML = typeof marked !== "undefined" ? marked.parse(solution.answer) : solution.answer.replace(/\n/g, '<br>');

                // Create container for references
                const referencesContainer = document.createElement('div');
                referencesContainer.classList.add('solution-references-container');

                const referencesHeader = document.createElement('div');
                referencesHeader.innerHTML = '<h5>Referencias <span class="toggle-icon">+</span></h5>';
                referencesHeader.classList.add('references-header');

                const referencesList = document.createElement('div');
                referencesList.classList.add('references-list', 'hidden');

                // If reference metadata exists, add it
                if (solution.metadata && solution.metadata.references && Array.isArray(solution.metadata.references) && solution.metadata.references.length > 0) {
                    solution.metadata.references.forEach((ref, index) => {
                        if (ref.metadata.collection === 'documentos') {
                            const refItemDiv = document.createElement('div');
                            refItemDiv.classList.add('metadata-item');

                            const refTitle = document.createElement('h6');
                            refTitle.textContent = `Referencia ${index + 1}${ref.metadata.title ? ': ' + ref.metadata.title : ''}`;
                            refItemDiv.appendChild(refTitle);

                            const detailsList = document.createElement('ul');
                            const fieldsToShow = ['page_number', 'author', 'subject'];
                            if (ref.metadata["filename"]) {
                                const viewDocumentUrl = `${apiEndpoint}/view_document/${encodeURIComponent(ref.metadata.filename)}`;
                                const sourceItem = document.createElement('a');
                                sourceItem.href = viewDocumentUrl;
                                sourceItem.textContent = 'Abrir documento';
                                sourceItem.target = "_blank";
                                detailsList.appendChild(sourceItem);
                            }
                            fieldsToShow.forEach(field => {
                                if (ref.metadata[field]) {
                                    const listItem = document.createElement('li');
                                    listItem.textContent = `${field.replace('_', ' ')}: ${ref.metadata[field]}`;
                                    detailsList.appendChild(listItem);
                                }
                            });
                            refItemDiv.appendChild(detailsList);
                            referencesList.appendChild(refItemDiv);
                        }
                    });
                } else {
                    referencesList.innerHTML = '<p>No hay referencias disponibles para esta solución.</p>';
                }


                referencesContainer.appendChild(referencesHeader);
                referencesContainer.appendChild(referencesList);
                answerDiv.appendChild(referencesContainer);

                // Click event to collapse/expand the answer
                questionDiv.addEventListener('click', () => {
                    answerDiv.classList.toggle('hidden');
                    answerDiv.classList.toggle('visible');
                    const icon = questionDiv.querySelector('.toggle-icon');
                    if (answerDiv.classList.contains('hidden')) {
                        icon.textContent = '+';
                    } else {
                        icon.textContent = '-';
                    }
                });

                // Event to collapse/expand references
                referencesHeader.addEventListener('click', (event) => {
                    event.stopPropagation();
                    referencesList.classList.toggle('hidden');
                    const icon = referencesHeader.querySelector('.toggle-icon');
                    if (referencesList.classList.contains('hidden')) {
                        icon.textContent = '+';
                    } else {
                        icon.textContent = '-';
                    }
                });

                solutionItem.appendChild(checkbox); // Add checkbox first
                solutionItem.appendChild(questionDiv);
                solutionItem.appendChild(answerDiv);
                likedSolutionsList.appendChild(solutionItem);
            });

        } catch (error) {
            console.error("Error al cargar las soluciones 'likeadas':", error);
            likedSolutionsList.innerHTML = '<p>Hubo un problema al cargar las soluciones.</p>';
        }
    }

    /**
     * Procesa las soluciones "likeadas" y las añade al vectorstore.
     * Muestra un estado de carga y el resultado del procesamiento.
     * @param {string} userName - El nombre de usuario actual.
     * @param {string} apiEndpoint - La URL base del endpoint de la API.
     */
    async function processLikedSolutions(userName, apiEndpoint) {
        if (!userName || !apiEndpoint) {
            showStatus(processSolutionsStatusDiv, "Error: Nombre de usuario o endpoint de API no disponible.", 'error');
            return;
        }

        showStatus(processSolutionsStatusDiv, '<i class="fas fa-spinner fa-spin"></i> Procesando soluciones...', '');
        processLikedSolutionsBtn.disabled = true;

        try {
            const response = await fetch(`${apiEndpoint}/process_liked_solutions/${userName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();

            if (response.ok) {
                showStatus(processSolutionsStatusDiv, `Procesamiento completado. Se añadieron ${result.count} nuevas soluciones.`, 'success');
                loadLikedSolutions(userName, apiEndpoint); // Reload to show updated list
            } else {
                showStatus(processSolutionsStatusDiv, `Error al procesar soluciones: ${result.detail || response.statusText}`, 'error');
            }
        } catch (error) {
            console.error("Error al procesar soluciones 'likeadas':", error);
            showStatus(processSolutionsStatusDiv, `Error de red al procesar soluciones: ${error.message}`, 'error');
        } finally {
            processLikedSolutionsBtn.disabled = false;
        }
    }

    // Function to update the UI based on selection mode
    function updateSolutionSelectionModeUI() {
        if (isSolutionSelectionMode) {
            likedSolutionsList.classList.add('selection-active');
            toggleSolutionSelectionModeBtn.textContent = "Cancelar Selección";
            deleteSelectedSolutionsBtn.classList.remove('hidden'); // Show delete button
            deleteSelectedSolutionsBtn.textContent = "Eliminar Soluciones Seleccionadas";
            deleteSelectedSolutionsBtn.disabled = true; // Disable delete button initially
        } else {
            likedSolutionsList.classList.remove('selection-active');
            toggleSolutionSelectionModeBtn.textContent = "Eliminar Soluciones";
            deleteSelectedSolutionsBtn.classList.add('hidden'); // Hide delete button
            selectedSolutionsToDelete = []; // Clear selected solutions
            document.querySelectorAll('.solution-checkbox').forEach(checkbox => checkbox.checked = false);
        }
        showStatus(deleteSolutionsStatusDiv, '', ''); // Clear status message
    }

    // Function to handle deletion of selected solutions
    async function deleteSelectedSolutions() {
        if (selectedSolutionsToDelete.length === 0) {
            showStatus(deleteSolutionsStatusDiv, "Por favor, selecciona las soluciones a eliminar.", 'error');
            return;
        }

        showStatus(deleteSolutionsStatusDiv, "Eliminando soluciones...", '');
        deleteSelectedSolutionsBtn.disabled = true;
        toggleSolutionSelectionModeBtn.disabled = true;

        try {
            const response = await fetch(`${window.apiEndpoint}/delete_solution`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                // CORRECTED LINE: Wrap the array in an object with 'reference_ids' key
                body: JSON.stringify({ reference_ids: selectedSolutionsToDelete })
            });

            const result = await response.json();

            if (response.ok) {
                showStatus(deleteSolutionsStatusDiv, `Soluciones eliminadas exitosamente.`, 'success');
                isSolutionSelectionMode = false; // Exit selection mode
                loadLikedSolutions(window.userName, window.apiEndpoint); // Reload the list
            } else {
                console.error("Delete response:", result); // Log the full error response from server
                showStatus(deleteSolutionsStatusDiv, `Error al eliminar soluciones: ${result.detail || response.statusText}`, 'error');
            }

        } catch (error) {
            console.error("Error deleting solutions:", error);
            showStatus(deleteSolutionsStatusDiv, `Error de red al eliminar soluciones: ${error.message}`, 'error');
        } finally {
            deleteSelectedSolutionsBtn.disabled = false;
            toggleSolutionSelectionModeBtn.disabled = false;
            if (deleteSolutionsStatusDiv && deleteSolutionsStatusDiv.classList.contains('success')) {
                // If deletion was successful, the UI will be reset by loadLikedSolutions
            } else {
                updateDeleteSolutionsButtonState(); // Otherwise, update button state
            }
        }
    }

    // Function to update the delete button's state
    function updateDeleteSolutionsButtonState() {
        if (isSolutionSelectionMode && deleteSelectedSolutionsBtn) {
            if (selectedSolutionsToDelete.length > 0) {
                deleteSelectedSolutionsBtn.textContent = `Eliminar Soluciones Seleccionadas (${selectedSolutionsToDelete.length})`;
                deleteSelectedSolutionsBtn.disabled = false;
                deleteSelectedSolutionsBtn.classList.remove('hidden');
            } else {
                deleteSelectedSolutionsBtn.textContent = "Eliminar Soluciones Seleccionadas";
                deleteSelectedSolutionsBtn.disabled = true;
                deleteSelectedSolutionsBtn.classList.add('hidden');
            }
        } else {
            deleteSelectedSolutionsBtn.classList.add('hidden');
        }
    }


    // Event listener for processing liked solutions
    if (processLikedSolutionsBtn) {
        processLikedSolutionsBtn.addEventListener('click', () => {
            processLikedSolutions(window.userName, window.apiEndpoint);
        });
    }

    // Event listener for toggling solution selection mode
    if (toggleSolutionSelectionModeBtn) {
        toggleSolutionSelectionModeBtn.addEventListener('click', () => {
            isSolutionSelectionMode = !isSolutionSelectionMode;
            updateSolutionSelectionModeUI();
            if (isSolutionSelectionMode) {
                showStatus(deleteSolutionsStatusDiv, '', ''); // Clear status when entering selection mode
            }
        });
    }

    // Event listener for deleting selected solutions
    if (deleteSelectedSolutionsBtn) {
        deleteSelectedSolutionsBtn.addEventListener('click', deleteSelectedSolutions);
    }


    // Event listener for checkbox changes within the solutions list
    if (likedSolutionsList) {
        likedSolutionsList.addEventListener('change', (event) => {
            if (isSolutionSelectionMode && event.target.classList.contains('solution-checkbox')) {
                const checkbox = event.target;
                const solutionReferenceId = checkbox.dataset.solutionReferenceId;

                if (checkbox.checked) {
                    if (!selectedSolutionsToDelete.includes(solutionReferenceId)) {
                        selectedSolutionsToDelete.push(solutionReferenceId);
                    }
                } else {
                    selectedSolutionsToDelete = selectedSolutionsToDelete.filter(id => id !== solutionReferenceId);
                }
                updateDeleteSolutionsButtonState();
            }
        });
    }

    // Export functions to be accessible globally from app.js
    window.loadLikedSolutions = loadLikedSolutions;
    window.processLikedSolutions = processLikedSolutions;
});
