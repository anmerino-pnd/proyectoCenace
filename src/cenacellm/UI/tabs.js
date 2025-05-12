document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Función para cambiar de pestaña
    function changeTab(tabId) {
        // Ocultar todos los contenidos de pestaña
        tabContents.forEach(content => {
            content.classList.add('hidden');
        });

        // Quitar la clase 'active' de todos los botones
        tabButtons.forEach(button => {
            button.classList.remove('active');
        });

        // Mostrar el contenido de la pestaña seleccionada
        const selectedTabContent = document.getElementById(`${tabId}-tab-content`);
        if (selectedTabContent) {
            selectedTabContent.classList.remove('hidden');
        }

        // Añadir la clase 'active' al botón seleccionado
        const selectedButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
        if (selectedButton) {
            selectedButton.classList.add('active');
        }
    }

    // Añadir evento click a cada botón de pestaña
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            changeTab(tabId);
        });
    });

    // Inicialmente mostrar la pestaña 'chat' (o la que esté marcada como active)
    const initialActiveTab = document.querySelector('.tab-button.active');
    if (initialActiveTab) {
        changeTab(initialActiveTab.getAttribute('data-tab'));
    }
});