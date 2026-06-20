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
                            
                            // Update stored grading data on the active tab
                            const activeTabState = window.TabStore && window.TabStore.active();
                            if (activeTabState && activeTabState.currentGradingData) {
                                activeTabState.currentGradingData.teacher_notes = notesText.trim();
                            } else if (window.currentGradingData) {
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
        
        // Update stored grading data on the active tab for PDF export
        const activeTabState = window.TabStore && window.TabStore.active();
        if (activeTabState && activeTabState.currentGradingData) {
            activeTabState.currentGradingData.teacher_notes = newNotes;
            console.log('✅ Updated active tab currentGradingData.teacher_notes via inline editor');
        } else if (window.currentGradingData) {
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

            // Recolor the score to track the new value (green for high, red for
            // low). Runs LAST — after all data + total updates — so it can never
            // interfere with the grading/score path.
            if (window.recolorCategoryScore) window.recolorCategoryScore(element);
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
 * Locate the .teacher-notes block associated with a suggestion chip button.
 * The chip can live in two places:
 *   1. As a sibling row right after the .teacher-notes block (in the result).
 *   2. Inside the edit-teacher-notes modal (no .teacher-notes nearby) — in that
 *      case the modal records the target element it was opened for.
 * @param {HTMLElement} btn - the .teacher-notes-suggestion-btn
 * @returns {HTMLElement|null}
 */
function findTeacherNotesBlockForChip(btn) {
    if (!btn) return null;

    // Case 1: chip is a sibling row inside the same grading summary.
    const summary = btn.closest('.grading-summary');
    if (summary) {
        const block = summary.querySelector('.teacher-notes.editable-section') ||
                      summary.querySelector('.teacher-notes');
        if (block) return block;
    }

    // Case 2: chip is inside the teacher-notes modal — resolve the target the
    // modal was opened for (set by openTeacherNotesModal).
    const modal = document.getElementById('teacherNotesModal');
    if (modal && modal.dataset.targetElement) {
        const target = document.getElementById(modal.dataset.targetElement);
        if (target) return target;
    }

    // Fallback: nearest ancestor (covers the legacy nested-chip layout).
    return btn.closest('.teacher-notes');
}

/**
 * Write a teacher-note value into a note block exactly the way the inline/modal
 * editors do, so the result is indistinguishable from a manual edit (same
 * dataset, content span, styling, grading-data update, and autosave event).
 * @param {HTMLElement} notesBlock - the .teacher-notes element
 * @param {string} noteText
 */
function commitTeacherNote(notesBlock, noteText) {
    if (!notesBlock) return;
    const note = (noteText || '').trim();

    notesBlock.dataset.teacherNotes = note;
    const contentElement = notesBlock.querySelector('.teacher-notes-content');
    if (contentElement) {
        contentElement.textContent = note || 'Click to add teacher notes';
    }

    if (note) {
        notesBlock.style.backgroundColor = '#fff3cd';
        notesBlock.title = 'Teacher notes: ' + note.substring(0, 100) +
                           (note.length > 100 ? '...' : '');
    } else {
        notesBlock.style.backgroundColor = '';
        notesBlock.title = 'Click to edit teacher notes';
    }

    // Persist to grading data (active tab first, legacy global fallback)
    const activeTabState = window.TabStore && window.TabStore.active();
    if (activeTabState && activeTabState.currentGradingData) {
        activeTabState.currentGradingData.teacher_notes = note;
    } else if (window.currentGradingData) {
        window.currentGradingData.teacher_notes = note;
    }

    // If the edit-teacher-notes modal is open for THIS block, keep its textarea
    // in sync so a toggle updates the text the teacher is editing, not just the
    // note behind the modal.
    const modal = document.getElementById('teacherNotesModal');
    if (modal && modal.dataset.targetElement === notesBlock.id) {
        const textArea = document.getElementById('teacherNotesText');
        if (textArea) {
            textArea.value = note;
            // Re-fit height if the editor auto-resizes.
            if (textArea.style.height) {
                textArea.style.height = 'auto';
                textArea.style.height = textArea.scrollHeight + 'px';
            }
        }
    }

    // auto-save.js debounces a save on this event.
    if (window.eventBus && typeof window.eventBus.emit === 'function') {
        window.eventBus.emit('teacher-notes:saved', { element: notesBlock, notes: note });
    }
}

/**
 * Update every "Focus on …" toggle pill bound to a given note block so they all
 * reflect the current mode and label. Pills carry both versions of the note
 * (data-note-two / data-note-one) and a data-mode marker. There can be two
 * pills live at once: the sibling row in the result, and the one in the modal.
 * @param {HTMLElement} notesBlock
 * @param {string} mode - 'two' (showing 2-cat note) or 'one'
 */
function syncTeacherNotesPills(notesBlock, mode) {
    const noteTwo = (notesBlock.dataset.teacherNotesPrimary || '');
    const noteOne = (notesBlock.dataset.teacherNotesSuggestion || '');

    // The sibling pill lives in the same grading summary as the note block.
    const summary = notesBlock.closest('.grading-summary');
    const pills = [];
    if (summary) {
        summary.querySelectorAll('.teacher-notes-suggestion-btn').forEach((p) => pills.push(p));
    }
    // The modal pill targets this block via the modal's dataset.targetElement.
    const modal = document.getElementById('teacherNotesModal');
    if (modal && modal.dataset.targetElement === notesBlock.id) {
        const modalPill = document.getElementById('teacherNotesSuggestionChip');
        if (modalPill && pills.indexOf(modalPill) === -1) pills.push(modalPill);
    }

    pills.forEach((pill) => {
        pill.dataset.noteTwo = noteTwo;
        pill.dataset.noteOne = noteOne;
        pill.dataset.mode = mode;
        // Label offers the OTHER focus than what's currently applied.
        pill.textContent = (mode === 'two') ? 'Focus on one category' : 'Focus on two categories';
    });
}

/**
 * Toggle a teacher note between its two-category and one-category versions.
 * Continuously interchangeable: each click swaps to the other version and
 * relabels every bound pill, so the teacher can flip back and forth freely.
 * @param {HTMLElement} pill - the clicked .teacher-notes-suggestion-btn
 */
function toggleTeacherNotesFocus(pill) {
    if (!pill) return;
    const notesBlock = findTeacherNotesBlockForChip(pill);
    if (!notesBlock) return;

    // Resolve both versions. The pill is the primary source (it always carries
    // both); fall back to the note block's datasets.
    const noteTwo = pill.dataset.noteTwo || notesBlock.dataset.teacherNotesPrimary || '';
    const noteOne = pill.dataset.noteOne || notesBlock.dataset.teacherNotesSuggestion || '';
    if (!noteTwo || !noteOne) return;

    const currentMode = pill.dataset.mode || 'two';
    const nextMode = currentMode === 'two' ? 'one' : 'two';
    const nextNote = nextMode === 'one' ? noteOne : noteTwo;

    commitTeacherNote(notesBlock, nextNote);
    syncTeacherNotesPills(notesBlock, nextMode);
    console.log(`✅ Toggled teacher note focus → ${nextMode === 'one' ? 'one category' : 'two categories'}`);
}

// Back-compat alias (older callers referenced applyTeacherNotesSuggestion).
function applyTeacherNotesSuggestion(notesBlock) {
    const summary = notesBlock && notesBlock.closest('.grading-summary');
    const pill = summary && summary.querySelector('.teacher-notes-suggestion-btn');
    if (pill) toggleTeacherNotesFocus(pill);
}

// One-time delegated listener: a click on a "Focus on …" pill toggles the note.
// stopPropagation keeps the click off the note block's edit handler. Delegation
// means it works for essays rendered after page load (batch grading, My Essays
// restore) on both index.html and account.html. The pill stays in place (it's a
// toggle), and the modal stays open so the teacher can keep flipping.
if (!window.__teacherNotesSuggestionWired) {
    window.__teacherNotesSuggestionWired = true;
    document.addEventListener('click', (e) => {
        const btn = e.target.closest && e.target.closest('.teacher-notes-suggestion-btn');
        if (!btn) return;
        e.stopPropagation();
        e.preventDefault();
        toggleTeacherNotesFocus(btn);
    });
}

// Export functions for module usage
window.EditingFunctionsModule = {
    editTeacherNotes,
    editStat,
    makeElementEditable,
    setupEditableElements,
    applyTeacherNotesSuggestion
};