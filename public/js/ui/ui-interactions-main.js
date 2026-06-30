/**
 * UI Interactions Main Module
 * Main controller for UI interactions, integrates all UI modules
 */

/**
 * Initialize UI interactions
 */
function initializeUIInteractions() {
    // Set up tab switching
    if (window.TabManagementModule) {
        window.TabManagementModule.setupTabSwitching();
    }

    // Note: ModalManager self-initializes in modals.js via DOMContentLoaded.
    // A duplicate initialize() call here was causing all modals to register
    // twice in the console. Removed 2026-04-09.

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
 * Color for a category score, matching the palette the backend formatter
 * (grader/formatter.js getScoreColor) uses at initial render — so a score
 * recolored after a manual edit looks identical to one the AI returned.
 * @param {number} percentage - Score percentage (0–100)
 * @returns {string} Hex color
 */
function getCategoryScoreColor(percentage) {
    if (percentage >= 90) return '#22C55E'; // Green - Excellent
    if (percentage >= 80) return '#84CC16'; // Light green - Good
    if (percentage >= 70) return '#EAB308'; // Yellow - Satisfactory
    if (percentage >= 60) return '#F97316'; // Orange - Needs improvement
    return '#EF4444'; // Red - Unsatisfactory
}

/**
 * Recompute and apply the score color for a category, so manually edited
 * scores update their color live (a higher score turns green, a lower one
 * red — matching how the AI's grades are colored). Targets both the editable
 * number input and its sibling "/max" span.
 *
 * @param {HTMLElement} inputEl - the .editable-score input that changed, OR an
 *   .editable-stat-score span ("points/max" format).
 */
function recolorCategoryScore(inputEl) {
  try {
    if (!inputEl) return;
    let points, max;

    if (inputEl.classList && inputEl.classList.contains('editable-stat-score')) {
        // "points/max" text span
        const m = (inputEl.textContent || '').match(/([\d.]+)\s*\/\s*([\d.]+)/);
        if (!m) return;
        points = parseFloat(m[1]);
        max = parseFloat(m[2]);
    } else {
        // number input
        points = parseFloat(inputEl.value);
        max = parseFloat(inputEl.max) || parseFloat(inputEl.dataset.outOf) || 0;
    }
    if (!isFinite(points) || !isFinite(max) || max <= 0) return;

    const pct = Math.round((points / max) * 100);
    const color = getCategoryScoreColor(pct);

    inputEl.style.color = color;

    // Recolor the adjacent "/max" span. It sits just after the
    // .score-input-container, as a sibling inside the same score wrapper.
    const container = inputEl.closest('.score-input-container');
    const wrapper = container ? container.parentElement : inputEl.parentElement;
    if (wrapper) {
        wrapper.querySelectorAll('span').forEach(span => {
            if (/^\s*\/\s*[\d.]+\s*$/.test(span.textContent || '')) {
                span.style.color = color;
            }
        });
    }
  } catch (e) {
    // Purely cosmetic — never let a recolor error affect grading/editing.
    console.warn('[recolorCategoryScore] skipped:', e && e.message);
  }
}

/**
 * Helper function to count words in text
 * @param {string} text - Text to count words in
 * @returns {number} Word count
 */
function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
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
            editingFunctions: !!window.EditingFunctionsModule
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
window.getScoreColor = getScoreColor;
window.getCategoryScoreColor = getCategoryScoreColor;
window.recolorCategoryScore = recolorCategoryScore;
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

    // Utilities
    getScoreColor,
    countWords,
    escapeHtml,
    showHelp,
    addKeyboardShortcut
};