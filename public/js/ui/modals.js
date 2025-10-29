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
        // Teacher Notes Modal
        this.registerModal('teacherNotes', {
            element: document.getElementById('teacherNotesModal'),
            handlers: {
                save: this.saveTeacherNotes.bind(this)
            }
        });

        // Edit Highlight Modal - DISABLED: Uses independent management in highlighting.js
        // this.registerModal('editHighlight', {
        //     element: document.getElementById('editModal'),
        //     handlers: {
        //         open: this.openEditModal.bind(this),
        //         close: this.closeEditModal.bind(this),
        //         save: this.saveEditModal.bind(this)
        //     }
        // });

        // Error Modal
        this.registerModal('error', {
            element: document.getElementById('errorModal'),
            handlers: {
                // No open handler to avoid recursion - openErrorModal handles this directly
                // No close handler to avoid recursion
            }
        });

        // Confirmation Modal
        this.registerModal('confirmation', {
            element: document.getElementById('confirmationModal'),
            handlers: {
                // No open handler to avoid recursion
                // No close handler to avoid recursion
            }
        });

        // Profile Management Modal - handled directly in event delegation to avoid conflicts
        // Not registering with modal manager to prevent recursion issues
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

        // Set up save button if it exists (skip for editHighlight modal - it has custom handling)
        const saveBtn = config.element.querySelector('.modal-save-btn');
        if (saveBtn && modalId !== 'editHighlight') {
            saveBtn.addEventListener('click', () => this.saveModal(modalId));
        }

        // Set up cancel button if it exists
        const cancelBtn = config.element.querySelector('.modal-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeModal(modalId));
        }

        // Set up remove button if it exists (for highlight modal)
        const removeBtn = config.element.querySelector('.modal-remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.removeHighlight(modalId));
        }

        logger.debug(`Registered modal: ${modalId}`);
    }

    /**
     * Set up event bus listeners
     */
    setupEventListeners() {
        eventBus.on('modal:open', (data) => {
            this.openModal(data.modalId, data.config);
        });

        eventBus.on('modal:close', (data) => {
            if (data.modalId) {
                this.closeModal(data.modalId);
            } else {
                this.closeActiveModal();
            }
        });

        eventBus.on('modal:save', (data) => {
            this.saveModal(data.modalId || this.activeModal);
        });

        // Teacher notes specific events
        eventBus.on('teacher-notes:open', (data) => {
            this.openTeacherNotesModal(data.element);
        });

        // Edit highlight specific events
        eventBus.on('highlight:edit', (data) => {
            this.openEditModal(data.element, data.category, data.notes);
        });
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
     * Remove highlight for edit modal
     * @param {string} modalId - Modal identifier
     */
    removeHighlight(modalId) {
        const modal = this.modals.get(modalId);
        if (!modal) {
            logger.error(`Modal not found: ${modalId}`);
            return false;
        }

        logger.info(`Removing highlight from modal: ${modalId}`);

        if (modalId === 'editHighlight') {
            const elementId = modal.element.dataset.editingElement;
            if (elementId && window.HighlightingModule) {
                const element = document.getElementById(elementId);
                if (element) {
                    window.HighlightingModule.removeHighlight(element);
                    this.closeModal(modalId);
                    return true;
                }
            }
        }

        logger.warn(`Could not remove highlight for modal: ${modalId}`);
        return false;
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

        // Update stored grading data if it exists
        if (window.currentGradingData) {
            window.currentGradingData.teacher_notes = notesText.trim();
        }

        eventBus.emit('teacher-notes:saved', {
            element: targetElement,
            notes: notesText
        });

        logger.info('Teacher notes saved');
    }

    /**
     * Open edit highlight modal
     * @param {HTMLElement} element - Element to edit
     * @param {string} category - Current category
     * @param {string} notes - Current notes
     */
    openEditModal(element, category = '', notes = '') {
        const modal = this.modals.get('editHighlight');
        if (!modal) return;

        const categorySelect = document.getElementById('editCategory');
        const correctionTextArea = document.getElementById('editCorrection');
        const explanationTextArea = document.getElementById('editExplanation');

        if (categorySelect) {
            categorySelect.value = category || element.dataset.category || 'grammar';
        }

        // Handle both old 'notes' field and new 'correction/explanation' fields
        const correction = element.dataset.correction || element.dataset.message || notes || '';
        const explanation = element.dataset.explanation || ''; // Don't fall back to notes - that contains correction

        if (correctionTextArea) {
            correctionTextArea.value = correction;
        }
        if (explanationTextArea) {
            explanationTextArea.value = explanation;
        }

        modal.element.dataset.editingElement = element.id;
        this.openModal('editHighlight', { targetElement: element, category, correction, explanation });
    }

    /**
     * Close edit modal
     */
    closeEditModal() {
        const modal = this.modals.get('editHighlight');
        if (!modal) {
            logger.error('Edit modal not found');
            return false;
        }

        logger.info('Closing edit modal');

        // Clear modal state to prevent interference between edits
        const modalElement = modal.element;
        modalElement.dataset.selectedCategories = '';
        modalElement.dataset.editingElement = '';

        // Reset all category button states
        modalElement.querySelectorAll('.modal-category-btn').forEach(btn => {
            btn.classList.remove('modal-category-selected');
            const category = btn.dataset.category;
            const isMechanics = category === 'mechanics';
            const isFluency = category === 'fluency';

            // Reset to default visual state
            if (isMechanics || isFluency) {
                btn.style.backgroundColor = btn.dataset.defaultColor || '#D3D3D3';
                btn.style.color = 'black';
            } else {
                btn.style.backgroundColor = 'transparent';
                btn.style.color = btn.dataset.defaultColor || '#FF8C00';
            }

            // Remove any checkmarks
            const checkmark = btn.querySelector('.checkmark');
            if (checkmark) {
                checkmark.remove();
            }
        });

        // Clear correction and explanation textareas
        const correctionTextArea = document.getElementById('editCorrection');
        const explanationTextArea = document.getElementById('editExplanation');
        if (correctionTextArea) {
            correctionTextArea.value = '';
        }
        if (explanationTextArea) {
            explanationTextArea.value = '';
        }

        // Hide the modal directly without calling handlers to avoid recursion
        modal.element.style.display = 'none';
        modal.data = {};

        // Clean up drag listeners
        if (modal.element._dragCleanup) {
            modal.element._dragCleanup();
        }

        // Update active modal
        if (this.activeModal === 'editHighlight') {
            this.activeModal = null;
        }

        eventBus.emit('modal:closed', { modalId: 'editHighlight' });
        return true;
    }

    /**
     * Save edit modal changes
     */
    saveEditModal() {
        const modal = this.modals.get('editHighlight');
        const modalElement = document.getElementById('editModal');
        const correctionTextArea = document.getElementById('editCorrection');
        const explanationTextArea = document.getElementById('editExplanation');

        // Get selected categories from modal data
        const selectedCategories = modalElement?.dataset?.selectedCategories || '';
        const categories = selectedCategories ? selectedCategories.split(',').filter(c => c.trim()) : [];
        const correction = correctionTextArea?.value || '';
        const explanation = explanationTextArea?.value || '';

        logger.debug('Saving highlight edit:', { categories, correction, explanation });

        const elementId = modal?.element.dataset?.editingElement;
        if (elementId) {
            const element = document.getElementById(elementId);
            if (element) {
                // Store multiple categories
                element.dataset.category = categories.join(',');
                element.dataset.correction = correction;
                element.dataset.explanation = explanation;

                // Also set message and notes for backwards compatibility
                element.dataset.message = correction;
                element.dataset.notes = explanation || correction;

                // Update visual styling (use first category as primary)
                const primaryCategory = categories[0] || 'grammar';
                if (window.HighlightingModule) {
                    window.HighlightingModule.updateHighlightVisualStyling(element, primaryCategory);
                }

                console.log('Emitting highlight:updated event', {
                    element,
                    categories,
                    correction,
                    explanation
                });

                eventBus.emit('highlight:updated', {
                    element,
                    categories,
                    correction,
                    explanation
                });

                logger.debug('Updated highlight element:', element);
            } else {
                logger.error('Could not find element to update:', elementId);
            }
        } else {
            logger.error('No element ID stored for editing');
        }

        this.closeEditModal();
    }

    /**
     * Open profile modal
     */
    openProfileModal(config = {}) {
        logger.info('Opening profile management modal');

        // Load and display profiles list when opening
        if (window.ProfilesModule) {
            window.ProfilesModule.loadProfilesList();
        }

        // Open the modal using the base functionality
        this.openModal('profileManagement', config);
    }

    /**
     * Close profile modal
     */
    closeProfileModal() {
        // Just hide the modal directly to avoid circular reference
        const modal = document.getElementById('profileManagementModal');
        if (modal) {
            modal.style.display = 'none';
            this.activeModal = null;
        }
    }

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

    // Legacy function exports
    window.openTeacherNotesModal = (element) => modalManager.openTeacherNotesModal(element);
    window.closeTeacherNotesModal = () => modalManager.closeTeacherNotesModal();
    window.saveTeacherNotes = () => modalManager.saveTeacherNotes();
    // Edit modal functions disabled - handled independently in highlighting.js
    window.closeEditModal = () => console.log('Edit modal close handled by highlighting.js');
    window.saveEditModal = () => console.log('Edit modal save handled by highlighting.js');
    window.showError = (message, title) => modalManager.showError(message, title);
    window.showConfirmation = (message, onYes, onNo, title) => modalManager.showConfirmation(message, onYes, onNo, title);
}