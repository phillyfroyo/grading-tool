/**
 * Editing Functions Module
 * Handles inline editing functionality for various elements
 */

/**
 * Edit teacher notes inline
 * @param {HTMLElement} element - Element to edit
 */
function editTeacherNotes(element) {
    if (window.ModalManagementModule) {
        window.ModalManagementModule.openTeacherNotesModal(element);
    } else {
        // Fallback to prompt
        const currentNotes = element.dataset.teacherNotes || '';
        const newNotes = prompt('Edit teacher notes:', currentNotes);
        if (newNotes !== null) {
            element.dataset.teacherNotes = newNotes;
            if (newNotes.trim()) {
                element.style.backgroundColor = '#fff3cd';
                element.title = 'Teacher notes: ' + newNotes.substring(0, 100) + (newNotes.length > 100 ? '...' : '');
            } else {
                element.style.backgroundColor = '';
                element.title = '';
            }
        }
    }
}

/**
 * Edit statistics inline
 * @param {HTMLElement} element - Statistics element
 * @param {string} statType - Type of statistic
 */
function editStat(element, statType) {
    const currentValue = element.textContent;
    const newValue = prompt(`Edit ${statType}:`, currentValue);

    if (newValue !== null && newValue.trim() !== '') {
        const trimmedValue = newValue.trim();
        element.textContent = trimmedValue;
        element.dataset.edited = 'true';
        element.style.backgroundColor = '#e8f5e8';

        // Check if this is a score in format "points/max" and update data structure
        const scoreMatch = trimmedValue.match(/(\d+)\/(\d+)/);
        if (scoreMatch && element.closest('.category-feedback, .category-item')) {
            const points = parseInt(scoreMatch[1]);
            const maxPoints = parseInt(scoreMatch[2]);
            const categoryElement = element.closest('.category-feedback, .category-item');
            const category = categoryElement?.dataset?.category || element.dataset?.category;

            // Update the underlying data structure if available (GPT grading)
            if (category && window.SingleResultModule && window.SingleResultModule.getCurrentGradingData) {
                const currentData = window.SingleResultModule.getCurrentGradingData();
                if (currentData && currentData.scores && currentData.scores[category]) {
                    currentData.scores[category].points = points;
                    currentData.scores[category].out_of = maxPoints;
                }
            }

            // Also try to update manual grading data if available
            if (category && window.ManualGradingManager && window.ManualGradingManager.updateCategoryScore) {
                window.ManualGradingManager.updateCategoryScore(category, points, maxPoints);
            }
        }

        // Update total score when individual scores are edited
        if (typeof updateTotalScore === 'function') {
            updateTotalScore();
        }
    }
}

/**
 * Edit transitions
 * @param {HTMLElement} element - Transitions element
 */
function editTransitions(element) {
    const currentValue = element.textContent;
    const newValue = prompt('Edit transitions:', currentValue);

    if (newValue !== null) {
        element.textContent = newValue;
        element.dataset.edited = 'true';
        element.style.backgroundColor = '#e8f5e8';
    }
}

/**
 * Edit vocabulary
 * @param {HTMLElement} element - Vocabulary element
 */
function editVocabulary(element) {
    const currentValue = element.textContent;
    const newValue = prompt('Edit vocabulary:', currentValue);

    if (newValue !== null) {
        element.textContent = newValue;
        element.dataset.edited = 'true';
        element.style.backgroundColor = '#e8f5e8';
    }
}

/**
 * Edit grammar
 * @param {HTMLElement} element - Grammar element
 */
function editGrammar(element) {
    const currentValue = element.textContent;
    const newValue = prompt('Edit grammar:', currentValue);

    if (newValue !== null) {
        element.textContent = newValue;
        element.dataset.edited = 'true';
        element.style.backgroundColor = '#e8f5e8';
    }
}

/**
 * Make an element editable with inline editing
 * @param {HTMLElement} element - Element to make editable
 * @param {Function} onSave - Callback when saving changes
 */
function makeElementEditable(element, onSave = null) {
    element.addEventListener('click', function() {
        if (this.isContentEditable) return;

        const originalValue = this.textContent;
        this.contentEditable = true;
        this.focus();
        this.style.border = '2px solid #007bff';
        this.style.backgroundColor = '#fff';

        const saveChanges = () => {
            this.contentEditable = false;
            this.style.border = '';
            this.style.backgroundColor = '#e8f5e8';
            this.dataset.edited = 'true';

            if (onSave) {
                onSave(this.textContent, originalValue);
            }
        };

        const cancelChanges = () => {
            this.contentEditable = false;
            this.style.border = '';
            this.style.backgroundColor = '';
            this.textContent = originalValue;
        };

        // Save on Enter or blur
        this.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveChanges();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelChanges();
            }
        });

        this.addEventListener('blur', saveChanges, { once: true });
    });
}

/**
 * Setup editable elements in the document
 */
function setupEditableElements() {
    // Make teacher notes editable
    document.querySelectorAll('.teacher-notes-content').forEach(element => {
        makeElementEditable(element, (newValue, oldValue) => {
            console.log('Teacher notes updated:', { old: oldValue, new: newValue });
        });
    });

    // Make stat values editable
    document.querySelectorAll('.stat-value').forEach(element => {
        makeElementEditable(element, (newValue, oldValue) => {
            console.log('Stat updated:', { old: oldValue, new: newValue });
        });
    });

    // Make feedback textareas expandable
    document.querySelectorAll('.editable-feedback').forEach(textarea => {
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
    });
}

/**
 * Create an inline editor for any text element
 * @param {HTMLElement} element - Element to edit
 * @param {Object} options - Editor options
 */
function createInlineEditor(element, options = {}) {
    const {
        placeholder = 'Enter text...',
        multiline = false,
        validation = null,
        onSave = null,
        onCancel = null
    } = options;

    const originalValue = element.textContent;
    const originalStyles = {
        border: element.style.border,
        backgroundColor: element.style.backgroundColor,
        padding: element.style.padding
    };

    // Create input/textarea
    const input = document.createElement(multiline ? 'textarea' : 'input');
    input.value = originalValue;
    input.placeholder = placeholder;
    input.style.cssText = `
        width: 100%;
        border: 2px solid #007bff;
        background: #fff;
        padding: 4px 8px;
        font-size: inherit;
        font-family: inherit;
        resize: ${multiline ? 'vertical' : 'none'};
    `;

    if (multiline) {
        input.rows = 3;
    }

    // Replace element content with input
    element.innerHTML = '';
    element.appendChild(input);
    input.focus();
    input.select();

    const saveChanges = () => {
        const newValue = input.value;

        // Validate if validator provided
        if (validation && !validation(newValue)) {
            return;
        }

        element.textContent = newValue;
        Object.assign(element.style, originalStyles);
        element.style.backgroundColor = '#e8f5e8';
        element.dataset.edited = 'true';

        if (onSave) {
            onSave(newValue, originalValue);
        }
    };

    const cancelChanges = () => {
        element.textContent = originalValue;
        Object.assign(element.style, originalStyles);

        if (onCancel) {
            onCancel();
        }
    };

    // Event handlers
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !multiline) {
            e.preventDefault();
            saveChanges();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelChanges();
        }
    });

    input.addEventListener('blur', saveChanges);

    return input;
}

// Export functions for module usage
window.EditingFunctionsModule = {
    editTeacherNotes,
    editStat,
    editTransitions,
    editVocabulary,
    editGrammar,
    makeElementEditable,
    setupEditableElements,
    createInlineEditor
};