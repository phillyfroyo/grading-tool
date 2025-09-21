/**
 * UI Interactions Main Module
 * Main controller for UI interactions, integrates all UI modules
 */

/**
 * Initialize UI interactions
 */
function initializeUIInteractions() {
    console.log('🔧 Initializing UI interactions...');

    // Set up tab switching
    if (window.TabManagementModule) {
        window.TabManagementModule.setupTabSwitching();
    }

    // Initialize modal manager
    if (window.ModalManager) {
        window.ModalManager.initialize();
    }

    // Set up keyboard shortcuts
    if (window.KeyboardShortcutsModule) {
        window.KeyboardShortcutsModule.setupKeyboardShortcuts();
    }

    // Set up main grading functionality
    if (window.FormHandlingModule) {
        window.FormHandlingModule.setupMainGrading();
        window.FormHandlingModule.setupManualGrading();
        window.FormHandlingModule.setupFormValidation();
    }

    // Setup editing functions
    if (window.EditingFunctionsModule) {
        window.EditingFunctionsModule.setupEditableElements();
    }

    console.log('✅ UI interactions initialized');
}

/**
 * Switch between tabs
 * @param {string} tabName - Tab name to switch to
 */
function switchTab(tabName) {
    if (window.TabManagementModule) {
        window.TabManagementModule.switchTab(tabName);
    }
}

/**
 * Open teacher notes modal
 * @param {HTMLElement} element - Element that triggered the modal
 */
function openTeacherNotesModal(element) {
    if (window.ModalManagementModule) {
        window.ModalManagementModule.openTeacherNotesModal(element);
    }
}

/**
 * Close teacher notes modal
 */
function closeTeacherNotesModal() {
    if (window.ModalManagementModule) {
        window.ModalManagementModule.closeTeacherNotesModal();
    }
}

/**
 * Save teacher notes
 */
function saveTeacherNotes() {
    if (window.ModalManagementModule) {
        window.ModalManagementModule.saveTeacherNotes();
    }
}

/**
 * Close edit modal - DISABLED: Handled independently in highlighting.js
 */
function closeEditModal() {
    console.log('Edit modal close handled independently by highlighting.js');
    // if (window.ModalManagementModule) {
    //     window.ModalManagementModule.closeEditModal();
    // }
}

/**
 * Save edit modal changes - DISABLED: Handled independently in highlighting.js
 */
function saveEditModal() {
    console.log('Edit modal save handled independently by highlighting.js');
    // if (window.ModalManagementModule) {
    //     window.ModalManagementModule.saveEditModal();
    // }
}

/**
 * Edit teacher notes inline
 * @param {HTMLElement} element - Element to edit
 */
function editTeacherNotes(element) {
    if (window.EditingFunctionsModule) {
        window.EditingFunctionsModule.editTeacherNotes(element);
    }
}

/**
 * Edit statistics inline
 * @param {HTMLElement} element - Statistics element
 * @param {string} statType - Type of statistic
 */
function editStat(element, statType) {
    if (window.EditingFunctionsModule) {
        window.EditingFunctionsModule.editStat(element, statType);
    }
}

/**
 * Edit transitions
 * @param {HTMLElement} element - Transitions element
 */
function editTransitions(element) {
    if (window.EditingFunctionsModule) {
        window.EditingFunctionsModule.editTransitions(element);
    }
}

/**
 * Edit vocabulary
 * @param {HTMLElement} element - Vocabulary element
 */
function editVocabulary(element) {
    if (window.EditingFunctionsModule) {
        window.EditingFunctionsModule.editVocabulary(element);
    }
}

/**
 * Edit grammar
 * @param {HTMLElement} element - Grammar element
 */
function editGrammar(element) {
    if (window.EditingFunctionsModule) {
        window.EditingFunctionsModule.editGrammar(element);
    }
}

/**
 * Handle manual grading form submission
 * @param {Event} e - Form submission event
 */
function handleManualGradingSubmission(e) {
    if (window.FormHandlingModule) {
        window.FormHandlingModule.handleManualGradingSubmission(e);
    }
}

/**
 * Update manual score display
 */
function updateManualScore() {
    if (window.FormHandlingModule) {
        window.FormHandlingModule.updateManualScore();
    }
}

/**
 * Clear manual form
 */
function clearManualForm() {
    if (window.FormHandlingModule) {
        window.FormHandlingModule.clearManualForm();
    }
}

/**
 * Display manual grading results
 * @param {Object} result - Manual grading result object
 */
function displayManualGradingResults(result) {
    if (window.ManualGradingModule) {
        window.ManualGradingModule.displayManualGradingResults(result);
    }
}

/**
 * Clear manual grading results
 */
function clearManualResults() {
    if (window.ManualGradingModule) {
        window.ManualGradingModule.clearManualResults();
    }
}

/**
 * Export manual results to PDF
 */
function exportManualResults() {
    if (window.ManualGradingModule) {
        window.ManualGradingModule.exportManualResults();
    }
}

/**
 * Test manual grading functionality
 */
function testManualGrading() {
    if (window.ManualGradingModule) {
        window.ManualGradingModule.testManualGrading();
    }
}

/**
 * Show help modal
 */
function showHelp() {
    if (window.KeyboardShortcutsModule) {
        window.KeyboardShortcutsModule.showHelpModal();
    }
}

/**
 * Get score color based on percentage
 * @param {number} percentage - Score percentage
 * @returns {string} Color code
 */
function getScoreColor(percentage) {
    if (percentage >= 90) return '#28a745'; // Green
    if (percentage >= 80) return '#20c997'; // Teal
    if (percentage >= 70) return '#ffc107'; // Yellow
    if (percentage >= 60) return '#fd7e14'; // Orange
    return '#dc3545'; // Red
}

/**
 * Helper function to count words in text
 * @param {string} text - Text to count words in
 * @returns {number} Word count
 */
function countWords(text) {
    if (window.ManualGradingModule) {
        return window.ManualGradingModule.countWords(text);
    }

    // Fallback implementation
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (window.ManualGradingModule) {
        return window.ManualGradingModule.escapeHtml(text);
    }

    // Fallback implementation
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show a modal with custom content
 * @param {string} title - Modal title
 * @param {string} content - Modal content
 * @param {Function} onSave - Save callback
 */
function showModal(title, content, onSave = null) {
    if (window.ModalManagementModule) {
        window.ModalManagementModule.showModal(title, content, onSave);
    }
}

/**
 * Hide a modal by ID
 * @param {string} modalId - Modal ID
 */
function hideModal(modalId) {
    if (window.ModalManagementModule) {
        window.ModalManagementModule.hideModal(modalId);
    }
}

/**
 * Add custom keyboard shortcut
 * @param {string} key - Key combination
 * @param {Function} callback - Callback function
 * @param {string} description - Description
 */
function addKeyboardShortcut(key, callback, description = '') {
    if (window.KeyboardShortcutsModule) {
        window.KeyboardShortcutsModule.addKeyboardShortcut(key, callback, description);
    }
}

/**
 * Get UI interaction status
 * @returns {Object} Status object
 */
function getUIStatus() {
    return {
        modulesLoaded: {
            tabManagement: !!window.TabManagementModule,
            modalManagement: !!window.ModalManagementModule,
            keyboardShortcuts: !!window.KeyboardShortcutsModule,
            formHandling: !!window.FormHandlingModule,
            editingFunctions: !!window.EditingFunctionsModule,
            manualGrading: !!window.ManualGradingModule
        },
        initialized: true
    };
}

/**
 * Cleanup UI interactions
 */
function cleanupUIInteractions() {
    // Any cleanup needed
    console.log('🧹 Cleaning up UI interactions...');
}

// Backward compatibility: expose functions globally for existing code
window.switchTab = switchTab;
window.openTeacherNotesModal = openTeacherNotesModal;
window.closeTeacherNotesModal = closeTeacherNotesModal;
window.saveTeacherNotes = saveTeacherNotes;
window.closeEditModal = closeEditModal;
window.saveEditModal = saveEditModal;
window.editTeacherNotes = editTeacherNotes;
window.editStat = editStat;
window.editTransitions = editTransitions;
window.editVocabulary = editVocabulary;
window.editGrammar = editGrammar;
window.updateManualScore = updateManualScore;
window.clearManualForm = clearManualForm;
window.displayManualGradingResults = displayManualGradingResults;
window.testManualGrading = testManualGrading;
window.getScoreColor = getScoreColor;
window.countWords = countWords;
window.escapeHtml = escapeHtml;

// Export main module
window.UIInteractionsModule = {
    // Core functions
    initializeUIInteractions,
    cleanupUIInteractions,
    getUIStatus,

    // Tab management
    switchTab,

    // Modal management
    openTeacherNotesModal,
    closeTeacherNotesModal,
    saveTeacherNotes,
    closeEditModal,
    saveEditModal,
    showModal,
    hideModal,

    // Editing functions
    editTeacherNotes,
    editStat,
    editTransitions,
    editVocabulary,
    editGrammar,

    // Form handling
    handleManualGradingSubmission,
    updateManualScore,
    clearManualForm,

    // Manual grading
    displayManualGradingResults,
    clearManualResults,
    exportManualResults,
    testManualGrading,

    // Utilities
    getScoreColor,
    countWords,
    escapeHtml,
    showHelp,
    addKeyboardShortcut
};