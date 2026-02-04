/**
 * Editing Functions Module
 * Handles inline editing functionality for various elements
 */

/**
 * Edit teacher notes inline
 * @param {HTMLElement} element - Element to edit
 */
function editTeacherNotes(element) {
    console.log('📝 editTeacherNotes called, element:', element);
    console.log('🔍 ModalManagementModule available:', !!window.ModalManagementModule);
    console.log('🔍 openTeacherNotesModal function available:', !!window.openTeacherNotesModal);
    
    // FORCE modal system to work - try all possible ways
    
    // Method 1: Try ModalManagementModule
    if (window.ModalManagementModule && typeof window.ModalManagementModule.openTeacherNotesModal === 'function') {
        console.log('✅ Using ModalManagementModule');
        try {
            window.ModalManagementModule.openTeacherNotesModal(element);
            return;
        } catch (error) {
            console.error('ModalManagementModule failed:', error);
        }
    }
    
    // Method 2: Try global function
    if (typeof window.openTeacherNotesModal === 'function') {
        console.log('✅ Using global openTeacherNotesModal function');
        try {
            window.openTeacherNotesModal(element);
            return;
        } catch (error) {
            console.error('Global openTeacherNotesModal failed:', error);
        }
    }
    
    // Method 3: Try to manually create and show modal
    const modal = document.getElementById('teacherNotesModal');
    const textArea = document.getElementById('teacherNotesText');
    
    if (modal && textArea) {
        console.log('✅ Using manual modal approach');
        try {
            // Get current notes
            const currentNotes = element.dataset.teacherNotes || '';
            const contentElement = element.querySelector('.teacher-notes-content');
            let displayedText = currentNotes;
            
            if ((!displayedText || displayedText === 'Click to add teacher notes') && contentElement) {
                displayedText = contentElement.textContent?.trim() || '';
                if (displayedText === 'Click to add teacher notes') {
                    displayedText = '';
                }
            }
            
            // Set up modal
            textArea.value = displayedText;
            modal.dataset.targetElement = element.id || ('teacher-notes-' + Date.now());
            if (!element.id) {
                element.id = modal.dataset.targetElement;
            }
            
            // Show modal
            modal.style.display = 'block';
            textArea.focus();
            textArea.select();
            
            // Make sure save function works
            if (!window.saveTeacherNotes) {
                window.saveTeacherNotes = () => {
                    const targetElementId = modal.dataset.targetElement;
                    const notesText = textArea.value || '';
                    
                    if (targetElementId) {
                        const targetElement = document.getElementById(targetElementId);
                        if (targetElement) {
                            // Update dataset
                            targetElement.dataset.teacherNotes = notesText.trim();
                            
                            // Update displayed content
                            const contentElement = targetElement.querySelector('.teacher-notes-content');
                            if (contentElement) {
                                if (notesText.trim()) {
                                    contentElement.textContent = notesText.trim();
                                } else {
                                    contentElement.textContent = 'Click to add teacher notes';
                                }
                            }
                            
                            // Update visual indicators
                            if (notesText.trim()) {
                                targetElement.style.backgroundColor = '#fff3cd';
                                targetElement.title = 'Teacher notes: ' + notesText.substring(0, 100) + (notesText.length > 100 ? '...' : '');
                            } else {
                                targetElement.style.backgroundColor = '';
                                targetElement.title = 'Click to edit teacher notes';
                            }
                            
                            // Update global data
                            if (window.currentGradingData) {
                                window.currentGradingData.teacher_notes = notesText.trim();
                            }
                        }
                    }
                    
                    // Close modal
                    modal.style.display = 'none';
                };
            }
            
            // Make sure close function works
            if (!window.closeTeacherNotesModal) {
                window.closeTeacherNotesModal = () => {
                    modal.style.display = 'none';
                };
            }
            
            console.log('✅ Modal opened manually');
            return;
        } catch (error) {
            console.error('Manual modal failed:', error);
        }
    }
    
    // Fallback: Enhanced inline editor
    console.log('⚠️ All modal methods failed, using enhanced inline editor');
    createTeacherNotesInlineEditor(element);
}

/**
 * Create a full-section inline editor for teacher notes
 * @param {HTMLElement} element - Teacher notes section element
 */
function createTeacherNotesInlineEditor(element) {
    // Prevent multiple editors
    if (element.querySelector('.teacher-notes-editor')) {
        return;
    }
    
    const contentElement = element.querySelector('.teacher-notes-content');
    const currentNotes = element.dataset.teacherNotes || '';
    
    // Get the current displayed text
    let displayedText = currentNotes;
    if ((!displayedText || displayedText === 'Click to add teacher notes') && contentElement) {
        displayedText = contentElement.textContent?.trim() || '';
        if (displayedText === 'Click to add teacher notes') {
            displayedText = '';
        }
    }
    
    // Hide the label and content temporarily
    const label = element.querySelector('.teacher-notes-label');
    const editIndicator = element.querySelector('.edit-indicator');
    if (label) label.style.display = 'none';
    if (contentElement) contentElement.style.display = 'none';
    if (editIndicator) editIndicator.style.display = 'none';
    
    // Create a textarea that fills the entire section
    const textarea = document.createElement('textarea');
    textarea.className = 'teacher-notes-editor';
    textarea.value = displayedText;
    textarea.placeholder = 'Enter teacher notes...';
    
    // Style the textarea to fill the section
    textarea.style.cssText = `
        width: 100%;
        height: 80px;
        min-height: 60px;
        border: 2px solid #007bff;
        border-radius: 4px;
        padding: 8px;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.4;
        resize: vertical;
        background: #fff;
        margin: 0;
        box-sizing: border-box;
    `;
    
    // Create action buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        margin-top: 8px;
        display: flex;
        gap: 8px;
        justify-content: flex-end;
    `;
    
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.style.cssText = `
        background: #28a745;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    `;
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = `
        background: #6c757d;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    `;
    
    buttonContainer.appendChild(saveButton);
    buttonContainer.appendChild(cancelButton);
    
    // Add textarea and buttons to the element
    element.appendChild(textarea);
    element.appendChild(buttonContainer);
    
    // Focus the textarea and select all text
    textarea.focus();
    textarea.select();
    
    // Save function
    const saveChanges = () => {
        const newNotes = textarea.value.trim();
        
        // Update the dataset
        element.dataset.teacherNotes = newNotes;
        
        // Update the displayed content
        if (contentElement) {
            if (newNotes) {
                contentElement.textContent = newNotes;
            } else {
                contentElement.textContent = 'Click to add teacher notes';
            }
        }
        
        // Update visual indicators
        if (newNotes) {
            element.style.backgroundColor = '#fff3cd';
            element.title = 'Teacher notes: ' + newNotes.substring(0, 100) + (newNotes.length > 100 ? '...' : '');
        } else {
            element.style.backgroundColor = '';
            element.title = 'Click to edit teacher notes';
        }
        
        // Update global data for PDF export
        if (window.currentGradingData) {
            window.currentGradingData.teacher_notes = newNotes;
            console.log('✅ Updated currentGradingData.teacher_notes via inline editor');
        }
        
        cleanup();
    };
    
    // Cancel function
    const cancelChanges = () => {
        cleanup();
    };
    
    // Cleanup function
    const cleanup = () => {
        // Remove editor elements
        if (textarea.parentNode) textarea.parentNode.removeChild(textarea);
        if (buttonContainer.parentNode) buttonContainer.parentNode.removeChild(buttonContainer);
        
        // Restore original elements
        if (label) label.style.display = '';
        if (contentElement) contentElement.style.display = '';
        if (editIndicator) editIndicator.style.display = '';
    };
    
    // Event listeners
    saveButton.addEventListener('click', saveChanges);
    cancelButton.addEventListener('click', cancelChanges);
    
    // Save on Ctrl+Enter, cancel on Escape
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cancelChanges();
        } else if (e.key === 'Enter' && e.ctrlKey) {
            saveChanges();
        }
    });
    
    // Auto-resize textarea as user types
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(60, textarea.scrollHeight) + 'px';
    });
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
        const scoreMatch = trimmedValue.match(/([\d.]+)\/([\d.]+)/);
        if (scoreMatch && element.closest('.category-feedback, .category-item')) {
            const points = parseFloat(scoreMatch[1]);
            const maxPoints = parseFloat(scoreMatch[2]);
            const categoryElement = element.closest('.category-feedback, .category-item');
            const category = categoryElement?.dataset?.category || element.dataset?.category;

            // Check if this is part of a batch essay by looking for batch-essay container
            let essayIndex = null;
            const batchEssayContainer = element.closest('[id^="batch-essay-"]');
            if (batchEssayContainer) {
                const idMatch = batchEssayContainer.id.match(/batch-essay-(\d+)/);
                if (idMatch) {
                    essayIndex = parseInt(idMatch[1]);
                }
            }

            // Update the appropriate data structure based on context
            if (category) {
                // For batch essays, update the specific essay's data
                if (essayIndex !== null && window.SingleResultModule && window.SingleResultModule.updateBatchScore) {
                    window.SingleResultModule.updateBatchScore(essayIndex, category, points, maxPoints);
                }
                // For single GPT grading
                else if (window.SingleResultModule && window.SingleResultModule.getCurrentGradingData) {
                    const currentData = window.SingleResultModule.getCurrentGradingData();
                    if (currentData && currentData.scores && currentData.scores[category]) {
                        currentData.scores[category].points = points;
                        currentData.scores[category].out_of = maxPoints;
                    }
                }
                // For manual grading
                else if (window.ManualGradingModule && window.ManualGradingModule.updateCategoryScore) {
                    window.ManualGradingModule.updateCategoryScore(category, points, maxPoints);
                }
            }

            // Update total score with correct context
            if (typeof updateTotalScore === 'function') {
                updateTotalScore(essayIndex); // Pass the essay index if available
            } else if (window.ManualGradingModule && window.ManualGradingModule.updateManualTotalScore) {
                window.ManualGradingModule.updateManualTotalScore();
            }
        } else {
            // For non-score stat edits, just update the display
            // Update total score in case this affects calculations
            if (typeof updateTotalScore === 'function') {
                // Check if we're in a batch context
                const batchEssayContainer = element.closest('[id^="batch-essay-"]');
                if (batchEssayContainer) {
                    const idMatch = batchEssayContainer.id.match(/batch-essay-(\d+)/);
                    if (idMatch) {
                        updateTotalScore(parseInt(idMatch[1]));
                    }
                } else {
                    updateTotalScore();
                }
            }
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
        // Auto-resize function
        const autoResize = function() {
            this.style.height = 'auto';
            this.style.height = Math.max(34, this.scrollHeight) + 'px';
        };

        // Resize on input
        textarea.addEventListener('input', autoResize);

        // Initial resize for pre-filled content
        setTimeout(() => autoResize.call(textarea), 50);
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