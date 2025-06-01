// soluciones.js
document.addEventListener('DOMContentLoaded', () => {
    const likedSolutionsList = document.getElementById('likedSolutionsList');

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

        likedSolutionsList.innerHTML = '<p>Cargando soluciones...</p>'; // Mensaje de carga

        try {
            const response = await fetch(`${apiEndpoint}/solutions/${userName}`);
            if (!response.ok) {
                const errorText = await response.text();
                likedSolutionsList.innerHTML = `<p>Error al cargar soluciones: ${response.status} - ${errorText}</p>`;
                console.error("Error fetching liked solutions:", errorText);
                return;
            }

            const solutions = await response.json();
            likedSolutionsList.innerHTML = ''; // Limpia el mensaje de carga

            if (!Array.isArray(solutions) || solutions.length === 0) {
                likedSolutionsList.innerHTML = '<p>No hay soluciones guardadas aún.</p>';
                return;
            }

            solutions.forEach(solution => {
                const solutionItem = document.createElement('div');
                solutionItem.classList.add('solution-item');

                const questionDiv = document.createElement('div');
                questionDiv.classList.add('solution-question');
                // Muestra la pregunta del usuario y un icono para colapsar/expandir
                questionDiv.innerHTML = `<span>${solution.question}</span> <span class="toggle-icon">+</span>`;
                questionDiv.dataset.solutionId = solution.id; // Almacena el ID de la solución

                const answerDiv = document.createElement('div');
                answerDiv.classList.add('solution-answer', 'hidden');
                // Asegúrate de que 'marked' esté disponible globalmente o impórtalo si es necesario
                answerDiv.innerHTML = typeof marked !== "undefined" ? marked.parse(solution.answer) : solution.answer.replace(/\n/g, '<br>');

                // Crea el contenedor para las referencias
                const referencesContainer = document.createElement('div');
                referencesContainer.classList.add('solution-references-container'); 

                const referencesHeader = document.createElement('div');
                // CAMBIO: Inicializa el icono de toggle de referencias como '+' para indicar que está contraído
                referencesHeader.innerHTML = '<h5>Referencias <span class="toggle-icon">+</span></h5>';
                referencesHeader.classList.add('references-header');

                const referencesList = document.createElement('div');
                // CAMBIO: Añade la clase 'hidden' para que las referencias estén contraídas por defecto.
                referencesList.classList.add('references-list', 'hidden'); 

                // Si hay metadatos de referencias, añádelos
                if (solution.metadata && solution.metadata.references && Array.isArray(solution.metadata.references) && solution.metadata.references.length > 0) {
                    solution.metadata.references.forEach((ref, index) => {
                        if (ref.metadata.collection === 'documentos') {
                            const refItemDiv = document.createElement('div');
                            refItemDiv.classList.add('metadata-item'); // Reutiliza el estilo

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
                answerDiv.appendChild(referencesContainer); // Añade las referencias dentro del answerDiv

                // Añade un evento de clic para colapsar/expandir la respuesta
                questionDiv.addEventListener('click', () => {
                    answerDiv.classList.toggle('hidden');
                    answerDiv.classList.toggle('visible'); // Para la animación
                    const icon = questionDiv.querySelector('.toggle-icon');
                    if (answerDiv.classList.contains('hidden')) {
                        icon.textContent = '+';
                    } else {
                        icon.textContent = '-';
                    }
                });

                // Evento para colapsar/expandir las referencias
                referencesHeader.addEventListener('click', (event) => {
                    event.stopPropagation(); // Evita que el clic en el encabezado de referencias propague al questionDiv
                    referencesList.classList.toggle('hidden');
                    const icon = referencesHeader.querySelector('.toggle-icon');
                    if (referencesList.classList.contains('hidden')) {
                        icon.textContent = '+';
                    } else {
                        icon.textContent = '-';
                    }
                });


                solutionItem.appendChild(questionDiv);
                solutionItem.appendChild(answerDiv);
                likedSolutionsList.appendChild(solutionItem);
            });

        } catch (error) {
            console.error("Error al cargar las soluciones 'likeadas':", error);
            likedSolutionsList.innerHTML = '<p>Hubo un problema al cargar las soluciones.</p>';
        }
    }

    // Exporta la función para que sea accesible globalmente desde app.js
    window.loadLikedSolutions = loadLikedSolutions;
});
