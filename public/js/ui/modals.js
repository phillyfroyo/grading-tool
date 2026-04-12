/**
 * Modal Management Module
 * Handles all modal dialogs and their interactions
 */

// Use global eventBus and logger (loaded via regular scripts)
const eventBus = window.eventBus || { on: () => {}, emit: () => {}, registerModule: () => {} };
const logger = window.LoggingModule ? window.LoggingModule.createLogger('UI:Modals') :
               { info: console.log, warn: console.warn, error: console.error, debug: console.log };

class ModalManager {
    constructor() {
        this.activeModal = null;
        this.modals = new Map();
        this.modalStack = [];
    }

    /**
     * Initialize modal functionality
     */
    initialize() {
        logger.info('Initializing modal functionality');

        this.registerModals();
        this.setupEventListeners();
        this.setupKeyboardHandlers();

        eventBus.registerModule('ModalManager', this);
    }

    /**
     * Register all available modals
     */
    registerModals() {
        this.registerModal('teacherNotes', {
            element: document.getElementById('teacherNotesModal'),
            handlers: {
                save: this.saveTeacherNotes.bind(this)
            }
        });

        this.registerModal('error', {
            element: document.getElementById('errorModal'),
            handlers: {}
        });

        this.registerModal('confirmation', {
            element: document.getElementById('confirmationModal'),
            handlers: {}
        });
    }

    /**
     * Register a modal with the manager
     * @param {string} modalId - Unique identifier for the modal
     * @param {object} config - Modal configuration
     */
    registerModal(modalId, config) {
        if (!config.element) {
            logger.warn(`Modal element not found for: ${modalId}`);
            return;
        }

        this.modals.set(modalId, {
            id: modalId,
            element: config.element,
            handlers: config.handlers || {},
            data: {}
        });

        // Set up close button if it exists
        const closeBtn = config.element.querySelector('.modal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal(modalId));
        }

        // Set up save button if it exists
        const saveBtn = config.element.querySelector('.modal-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveModal(modalId));
        }

        // Set up cancel button if it exists
        const cancelBtn = config.element.querySelector('.modal-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeModal(modalId));
        }

        logger.debug(`Registered modal: ${modalId}`);
    }

    /**
     * Set up event bus listeners.
     * Note: previously registered listeners for modal:open/close/save,
     * teacher-notes:open, and highlight:edit, but none of those events
     * were ever emitted — all callers use direct method calls instead.
     * Kept as a hook point in case event-driven modal control is needed
     * in the future.
     */
    setupEventListeners() {
        // Currently empty — all modal operations use direct method calls.
    }

    /**
     * Set up keyboard handlers
     */
    setupKeyboardHandlers() {
        document.addEventListener('keydown', (e) => {
            if (this.activeModal) {
                switch (e.key) {
                    case 'Escape':
                        e.preventDefault();
                        this.closeActiveModal();
                        break;
                    case 'Enter':
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            this.saveModal(this.activeModal);
                        }
                        break;
                }
            }
        });
    }

    /**
     * Open a modal
     * @param {string} modalId - Modal identifier
     * @param {object} config - Configuration for opening
     */
    openModal(modalId, config = {}) {
        // Prevent infinite recursion when trying to show error modal
        if (modalId === 'error' && this.activeModal === 'error') {
            console.error('Prevented infinite recursion in error modal');
            return false;
        }

        const modal = this.modals.get(modalId);
        if (!modal) {
            logger.error(`Modal not found: ${modalId}`);
            return false;
        }

        // Safety check for modal element
        if (!modal.element) {
            logger.error(`Modal element not found for: ${modalId}`);
            return false;
        }

        logger.info(`Opening modal: ${modalId}`);

        // Close any existing modal
        if (this.activeModal) {
            this.modalStack.push(this.activeModal);
            this.closeModal(this.activeModal, false);
        }

        // Show the modal
        modal.element.style.display = 'block';
        modal.data = { ...config };
        this.activeModal = modalId;

        // Call custom open handler
        if (modal.handlers.open) {
            modal.handlers.open(config);
        }

        // Add backdrop click handler
        this.setupBackdropClick(modal.element);

        // Make modal draggable
        this.makeDraggable(modal.element);

        eventBus.emit('modal:opened', { modalId });
        return true;
    }

    /**
     * Close a modal
     * @param {string} modalId - Modal identifier
     * @param {boolean} checkStack - Whether to check modal stack for previous modal
     */
    closeModal(modalId, checkStack = true) {
        const modal = this.modals.get(modalId);
        if (!modal) {
            logger.error(`Modal not found: ${modalId}`);
            return false;
        }

        logger.info(`Closing modal: ${modalId}`);

        // Hide the modal
        modal.element.style.display = 'none';
        modal.data = {};

        // Clean up drag listeners
        if (modal.element._dragCleanup) {
            modal.element._dragCleanup();
        }

        // Call custom close handler
        if (modal.handlers.close) {
            modal.handlers.close();
        }

        // Update active modal
        if (this.activeModal === modalId) {
            this.activeModal = null;

            // Check if there's a previous modal in the stack
            if (checkStack && this.modalStack.length > 0) {
                const previousModal = this.modalStack.pop();
                this.openModal(previousModal);
            }
        }

        eventBus.emit('modal:closed', { modalId });
        return true;
    }

    /**
     * Close the currently active modal
     */
    closeActiveModal() {
        if (this.activeModal) {
            this.closeModal(this.activeModal);
        }
    }

    /**
     * Save the current modal
     * @param {string} modalId - Modal identifier
     */
    saveModal(modalId) {
        const modal = this.modals.get(modalId);
        if (!modal) {
            logger.error(`Modal not found: ${modalId}`);
            return false;
        }

        // Prevent duplicate saves
        if (modal.saving) {
            logger.debug(`Modal ${modalId} already saving, skipping duplicate save`);
            return false;
        }

        modal.saving = true;
        logger.info(`Saving modal: ${modalId}`);

        // Call custom save handler
        if (modal.handlers.save) {
            modal.handlers.save();
        }

        eventBus.emit('modal:saved', { modalId });

        // Auto-close modal after saving
        this.closeModal(modalId);

        // Reset saving flag after a brief delay
        setTimeout(() => {
            modal.saving = false;
        }, 100);

        return true;
    }

    /**
     * Set up backdrop click to close modal
     * @param {HTMLElement} modalElement - Modal element
     */
    setupBackdropClick(modalElement) {
        modalElement.addEventListener('click', (e) => {
            if (e.target === modalElement) {
                this.closeActiveModal();
            }
        });
    }

    /**
     * Make modal draggable by its header
     * @param {HTMLElement} modalElement - Modal element
     */
    makeDraggable(modalElement) {
        const modalContent = modalElement.querySelector('.modal-content');
        const modalHeader = modalElement.querySelector('.modal-header');

        if (!modalContent || !modalHeader) return;

        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        let xOffset = 0, yOffset = 0;

        // Ensure the modal is positioned correctly for dragging
        modalContent.style.position = 'absolute';
        modalContent.style.top = '50%';
        modalContent.style.left = '50%';
        modalContent.style.transform = 'translate(-50%, -50%)';

        modalHeader.style.cursor = 'move';
        modalHeader.style.userSelect = 'none';

        const dragStart = (e) => {
            if (e.type === 'touchstart') {
                initialX = e.touches[0].clientX - xOffset;
                initialY = e.touches[0].clientY - yOffset;
            } else {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
            }

            if (e.target === modalHeader || modalHeader.contains(e.target)) {
                isDragging = true;
                modalContent.style.transition = 'none';
            }
        };

        const dragEnd = () => {
            isDragging = false;
            modalContent.style.transition = '';
        };

        const drag = (e) => {
            if (isDragging) {
                e.preventDefault();

                if (e.type === 'touchmove') {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                } else {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                }

                xOffset = currentX;
                yOffset = currentY;

                modalContent.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`;
            }
        };

        // Mouse events
        modalHeader.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        // Touch events for mobile
        modalHeader.addEventListener('touchstart', dragStart);
        document.addEventListener('touchmove', drag);
        document.addEventListener('touchend', dragEnd);

        // Store cleanup function for later use
        modalElement._dragCleanup = () => {
            modalHeader.removeEventListener('mousedown', dragStart);
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', dragEnd);
            modalHeader.removeEventListener('touchstart', dragStart);
            document.removeEventListener('touchmove', drag);
            document.removeEventListener('touchend', dragEnd);
        };
    }

    // Specific modal handlers

    /**
     * Open teacher notes modal
     * @param {HTMLElement} element - Element that triggered the modal
     */
    openTeacherNotesModal(element) {
        const modal = this.modals.get('teacherNotes');
        if (!modal) {
            logger.error('Teacher notes modal not found');
            return;
        }

        if (!element || !element.dataset) {
            logger.error('Teacher notes modal: invalid element provided');
            return;
        }

        // Ensure element has an ID for reference
        if (!element.id) {
            element.id = 'teacher-notes-target-' + Date.now();
        }

        // Get existing notes from dataset or displayed content
        let currentText = element.dataset.teacherNotes || '';
        if (!currentText || currentText === 'No notes provided') {
            const contentElement = element.querySelector('.teacher-notes-content');
            if (contentElement) {
                const displayedText = contentElement.textContent || '';
                if (displayedText && displayedText !== 'No notes provided' && displayedText !== 'Click to add teacher notes') {
                    currentText = displayedText;
                }
            }
        }

        // Set textarea value
        const textArea = document.getElementById('teacherNotesText');
        if (textArea) {
            textArea.value = currentText;
        }

        // Store target element reference
        modal.element.dataset.targetElement = element.id;

        // Open modal using the standard system, passing the target element in config
        this.openModal('teacherNotes', { targetElement: element });
    }

    /**
     * Close teacher notes modal
     */
    closeTeacherNotesModal() {
        this.closeModal('teacherNotes');
    }

    /**
     * Save teacher notes
     */
    saveTeacherNotes() {
        const modal = this.modals.get('teacherNotes');
        const targetElementId = modal?.element.dataset.targetElement;
        const textArea = document.getElementById('teacherNotesText');
        const notesText = textArea?.value || '';

        if (!targetElementId) {
            logger.error('No target element ID found for teacher notes');
            return;
        }

        const targetElement = document.getElementById(targetElementId);
        if (!targetElement) {
            logger.error('Target element not found:', targetElementId);
            return;
        }

        // Save to dataset and update content
        targetElement.dataset.teacherNotes = notesText.trim();

        // Update the displayed content
        const contentElement = targetElement.querySelector('.teacher-notes-content');
        if (contentElement) {
            contentElement.textContent = notesText.trim() || 'Click to add teacher notes';
        }

        // Update visual indicator based on content
        if (notesText.trim()) {
            targetElement.style.backgroundColor = '#fff3cd';
            targetElement.title = 'Teacher notes: ' + notesText.substring(0, 100) +
                                 (notesText.length > 100 ? '...' : '');
        } else {
            targetElement.style.backgroundColor = '';
            targetElement.title = 'Click to edit teacher notes';
        }

        targetElement.style.display = '';

        // Update stored grading data if it exists.
        // Writes to the active tab's state; falls back to the legacy window
        // global during the multi-phase migration in case TabStore isn't
        // loaded yet.
        const activeTabState = window.TabStore && window.TabStore.active();
        if (activeTabState && activeTabState.currentGradingData) {
            activeTabState.currentGradingData.teacher_notes = notesText.trim();
        } else if (window.currentGradingData) {
            window.currentGradingData.teacher_notes = notesText.trim();
        }

        eventBus.emit('teacher-notes:saved', {
            element: targetElement,
            notes: notesText
        });

        logger.info('Teacher notes saved');
    }

    // Note: editHighlight modal (open/close/save/remove) and profileManagement
    // modal (open/close) were removed 2026-04-10. Both are managed independently:
    //   - editHighlight: highlighting.js showHighlightEditModal()
    //   - profileManagement: event-delegation.js + profiles.js

    /**
     * Open error modal with message
     * @param {string|Object} config - Error message or config object
     */
    openErrorModal(config) {
        const modal = this.modals.get('error');
        if (!modal || !modal.element) return;

        // Handle both string message and config object
        const message = typeof config === 'string' ? config : (config.message || 'An unknown error occurred');
        const title = typeof config === 'object' && config.title ? config.title : 'Error';

        // Update modal content
        const errorMessageDiv = document.getElementById('errorMessage');
        const modalTitle = modal.element.querySelector('.modal-title');

        if (errorMessageDiv) {
            errorMessageDiv.innerHTML = message;
        }
        if (modalTitle) {
            modalTitle.textContent = title;
        }

        // Close any existing modal first
        if (this.activeModal && this.activeModal !== 'error') {
            this.closeModal(this.activeModal, false);
        }

        // Show the error modal directly without calling openModal to avoid recursion
        modal.element.style.display = 'block';
        modal.element.style.zIndex = '9999'; // Ensure it's on top
        this.activeModal = 'error';

        // Add backdrop click handler
        this.setupBackdropClick(modal.element);
    }

    /**
     * Close error modal
     */
    closeErrorModal() {
        const modal = this.modals.get('error');
        if (modal && modal.element) {
            modal.element.style.display = 'none';
            if (this.activeModal === 'error') {
                this.activeModal = null;
            }
        }
    }

    /**
     * Show error modal (public API)
     * @param {string} message - Error message
     * @param {string} title - Optional title
     */
    showError(message, title = 'Error') {
        this.openErrorModal({ message, title });
    }

    /**
     * Open confirmation modal with message and callbacks
     * @param {string|Object} config - Confirmation message or config object
     */
    openConfirmationModal(config) {
        const modal = this.modals.get('confirmation');
        if (!modal) return;

        // Handle both string message and config object
        const message = typeof config === 'string' ? config : (config.message || 'Are you sure?');
        const title = typeof config === 'object' && config.title ? config.title : 'Confirm Action';
        const onYes = typeof config === 'object' && config.onYes ? config.onYes : () => {};
        const onNo = typeof config === 'object' && config.onNo ? config.onNo : () => {};

        // Update modal content
        const confirmationMessageDiv = document.getElementById('confirmationMessage');
        const modalTitle = modal.element.querySelector('.modal-title');
        const yesButton = document.getElementById('confirmYes');
        const noButton = document.getElementById('confirmNo');

        if (confirmationMessageDiv) {
            confirmationMessageDiv.innerHTML = message;
        }
        if (modalTitle) {
            modalTitle.textContent = title;
        }

        // Set up button handlers
        if (yesButton) {
            yesButton.onclick = () => {
                this.closeConfirmationModal();
                onYes();
            };
        }
        if (noButton) {
            noButton.onclick = () => {
                this.closeConfirmationModal();
                onNo();
            };
        }

        // Show the modal directly to avoid recursion
        modal.element.style.display = 'block';
        this.activeModal = 'confirmation';

        // Add backdrop click handler
        this.setupBackdropClick(modal.element);

        // Make modal draggable
        this.makeDraggable(modal.element);
    }

    /**
     * Close confirmation modal
     */
    closeConfirmationModal() {
        const modal = this.modals.get('confirmation');
        if (modal && modal.element) {
            modal.element.style.display = 'none';
            if (this.activeModal === 'confirmation') {
                this.activeModal = null;
            }
        }
    }

    /**
     * Show confirmation modal (public API)
     * @param {string} message - Confirmation message
     * @param {Function} onYes - Callback for Yes button
     * @param {Function} onNo - Callback for No button (optional)
     * @param {string} title - Optional title
     */
    showConfirmation(message, onYes, onNo = () => {}, title = 'Confirm Action') {
        this.openConfirmationModal({ message, title, onYes, onNo });
    }

    /**
     * Get the currently active modal
     * @returns {string|null} Active modal ID
     */
    getActiveModal() {
        return this.activeModal;
    }

    /**
     * Check if a modal is registered
     * @param {string} modalId - Modal identifier
     * @returns {boolean} True if modal exists
     */
    hasModal(modalId) {
        return this.modals.has(modalId);
    }

    /**
     * Clean up modal manager
     */
    destroy() {
        this.modals.clear();
        this.modalStack = [];
        this.activeModal = null;
        logger.info('Modal manager destroyed');
    }
}

// Create and initialize the modal manager instance
const modalManager = new ModalManager();

// Initialize modal manager when DOM is ready
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            modalManager.initialize();
        });
    } else {
        modalManager.initialize();
    }

    // Legacy global access for backward compatibility during transition
    window.ModalManager = modalManager;
    window.ModalManagementModule = modalManager; // Add compatibility alias

    // Legacy function exports (used by event-delegation.js, editing-functions.js, profiles.js)
    window.openTeacherNotesModal = (element) => modalManager.openTeacherNotesModal(element);
    window.closeTeacherNotesModal = () => modalManager.closeTeacherNotesModal();
    window.saveTeacherNotes = () => modalManager.saveTeacherNotes();
    window.showError = (message, title) => modalManager.showError(message, title);
    window.showConfirmation = (message, onYes, onNo, title) => modalManager.showConfirmation(message, onYes, onNo, title);
}