/**
 * Make a modal draggable by its header
 * @param {string} modalId - The ID of the modal element
 */
function makeDraggable(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const modalContent = modal.querySelector('.modal-content');
    const modalHeader = modal.querySelector('.modal-header');

    if (!modalContent || !modalHeader) return;

    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    // Reset position when modal is shown
    const resetPosition = () => {
        modalContent.style.transform = "translate(-50%, -50%)";
        modalContent.style.position = "absolute";
        modalContent.style.top = "50%";
        modalContent.style.left = "50%";
        xOffset = 0;
        yOffset = 0;
    };

    modalHeader.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    // Also handle touch events for mobile
    modalHeader.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', dragEnd);

    function dragStart(e) {
        if (e.target.classList.contains('modal-close-btn')) return;

        // Get initial position if not yet dragged
        if (xOffset === 0 && yOffset === 0) {
            const rect = modalContent.getBoundingClientRect();
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            xOffset = rect.left + rect.width / 2 - centerX;
            yOffset = rect.top + rect.height / 2 - centerY;
        }

        if (e.type === "touchstart") {
            initialX = e.touches[0].clientX - xOffset;
            initialY = e.touches[0].clientY - yOffset;
        } else {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        }

        if (e.target === modalHeader || modalHeader.contains(e.target)) {
            isDragging = true;
            modalHeader.style.cursor = 'grabbing';
        }
    }

    function drag(e) {
        if (!isDragging) return;

        e.preventDefault();

        if (e.type === "touchmove") {
            currentX = e.touches[0].clientX - initialX;
            currentY = e.touches[0].clientY - initialY;
        } else {
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
        }

        xOffset = currentX;
        yOffset = currentY;

        // Calculate position relative to center
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const translateX = currentX;
        const translateY = currentY;

        modalContent.style.transform = `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px))`;
    }

    function dragEnd(e) {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
        modalHeader.style.cursor = 'move';
    }

    // Reset position when modal is closed
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'style') {
                const display = window.getComputedStyle(modal).display;
                if (display === 'none') {
                    resetPosition();
                }
            }
        });
    });

    observer.observe(modal, { attributes: true });

    // Initialize
    resetPosition();
}

// Make all modals draggable when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Make edit modal draggable
    makeDraggable('editModal');
    makeDraggable('teacherNotesModal');
    makeDraggable('profileManagementModal');
    makeDraggable('confirmationModal');
});

// Export for use in other modules
window.DraggableModal = {
    makeDraggable
};