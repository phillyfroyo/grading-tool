/**
 * Highlighting Module
 * Handles text highlighting functionality for essays
 */

/**
 * Get category data including color and display information
 * @param {string} category - Category name
 * @returns {Object|null} Category data object or null
 */
function getCategoryData(category) {
    const categories = {
        'grammar': { color: '#FF8C00', name: 'Grammar Error' },
        'vocabulary': { color: '#00A36C', name: 'Vocabulary Error' },
        'mechanics': { color: '#D3D3D3', name: 'Mechanics Error' },
        'spelling': { color: '#DC143C', name: 'Spelling Error' },
        'fluency': { color: '#87CEEB', name: 'Fluency Error' },
        'delete': { color: '#000000', name: 'Delete Word' }
    };
    return categories[category] || null;
}

/**
 * Apply highlight to selected text
 * @param {Range} range - Selection range
 * @param {string} text - Selected text
 * @param {string} category - Highlight category
 */
function applyHighlight(range, text, category) {
    try {
        const mark = document.createElement('mark');
        mark.className = `highlight-${category}`;
        mark.dataset.category = category;
        mark.dataset.originalText = text;
        mark.style.cursor = 'pointer';
        // Build tooltip showing both correction and explanation
        const correction = mark.dataset.correction || mark.dataset.message || '';
        const explanation = mark.dataset.explanation || '';
        let tooltip = `Correction: ${correction || 'None'}`;
        if (explanation) {
            tooltip += `\nExplanation: ${explanation}`;
        } else {
            tooltip += `\nExplanation: None`;
        }
        mark.title = tooltip;

        // Add unique ID for modal reference
        mark.id = `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Check if "remove all from PDF" checkbox is checked and auto-exclude if so
        const removeAllCheckbox = document.getElementById('highlights-content-remove-all');
        if (removeAllCheckbox && removeAllCheckbox.checked) {
            mark.dataset.excludeFromPdf = 'true';
            console.log('🚫 Auto-excluding new highlight from PDF (checkbox is checked)');
        }

        // Apply visual styling
        updateHighlightVisualStyling(mark, category);

        // Add click handler for editing
        mark.addEventListener('click', function(e) {
            e.stopPropagation();
            editHighlight(this);
        });

        // Use extractContents and insertNode for complex ranges that span multiple elements
        try {
            range.surroundContents(mark);
        } catch (surroundError) {
            console.log('🔄 surroundContents failed, using extractContents method for complex selection');
            // Extract the selected content
            const extractedContent = range.extractContents();
            // Append the extracted content to our mark element
            mark.appendChild(extractedContent);
            // Insert the mark at the range position
            range.insertNode(mark);
        }

        // Auto-open modal for editing the new highlight
        setTimeout(() => {
            showHighlightEditModal(mark, [category]);
        }, 100); // Small delay to ensure DOM is updated

    } catch (error) {
        console.error('Error applying highlight:', error);
        if (window.TextSelectionModule) {
            window.TextSelectionModule.updateSelectionStatus('Error applying highlight. Try selecting plain text only.');
        }
    }
}

/**
 * Apply highlight for batch essays
 * @param {Range} range - Selection range
 * @param {string} text - Selected text
 * @param {string} category - Highlight category
 * @param {number} essayIndex - Essay index
 */
function applyBatchHighlight(range, text, category, essayIndex) {
    try {
        const mark = document.createElement('mark');
        mark.className = `highlight-${category}`;
        mark.dataset.category = category;
        mark.dataset.originalText = text;
        mark.dataset.essayIndex = essayIndex;
        mark.style.cursor = 'pointer';
        // Build tooltip showing both correction and explanation
        const correction = mark.dataset.correction || mark.dataset.message || '';
        const explanation = mark.dataset.explanation || '';
        let tooltip = `Correction: ${correction || 'None'}`;
        if (explanation) {
            tooltip += `\nExplanation: ${explanation}`;
        } else {
            tooltip += `\nExplanation: None`;
        }
        mark.title = tooltip;

        // Add unique ID for modal reference
        mark.id = `highlight-${essayIndex}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Check if "remove all from PDF" checkbox is checked and auto-exclude if so
        const removeAllCheckbox = document.getElementById(`highlights-tab-${essayIndex}-remove-all`);
        if (removeAllCheckbox && removeAllCheckbox.checked) {
            mark.dataset.excludeFromPdf = 'true';
            console.log(`🚫 Auto-excluding new highlight from PDF for essay ${essayIndex} (checkbox is checked)`);
        }

        // Apply visual styling
        updateHighlightVisualStyling(mark, category);

        // Add click handler for editing
        mark.addEventListener('click', function(e) {
            e.stopPropagation();
            editBatchHighlight(this, essayIndex);
        });

        // Use extractContents and insertNode for complex ranges that span multiple elements
        try {
            range.surroundContents(mark);
        } catch (surroundError) {
            console.log('🔄 surroundContents failed, using extractContents method for complex selection');
            // Extract the selected content
            const extractedContent = range.extractContents();
            // Append the extracted content to our mark element
            mark.appendChild(extractedContent);
            // Insert the mark at the range position
            range.insertNode(mark);
        }

        // Auto-open modal for editing the new highlight
        setTimeout(() => {
            showHighlightEditModal(mark, [category]);
        }, 100); // Small delay to ensure DOM is updated

    } catch (error) {
        console.error('Error applying highlight:', error);
        if (window.TextSelectionModule) {
            window.TextSelectionModule.updateBatchSelectionStatus(essayIndex, 'Error applying highlight. Try selecting plain text only.');
        }
    }
}

/**
 * Update highlight visual styling
 * @param {HTMLElement} element - Highlight element
 * @param {string} primaryCategory - Primary category
 */
function updateHighlightVisualStyling(element, primaryCategory, allCategories = null) {
    const categoryStyles = {
        grammar: { color: '#FF8C00', backgroundColor: 'rgba(255, 140, 0, 0.3)' },
        vocabulary: { color: '#00A36C', backgroundColor: 'rgba(0, 163, 108, 0.3)' },
        mechanics: { backgroundColor: '#D3D3D3', color: '#000000' },
        spelling: { color: '#DC143C', backgroundColor: 'rgba(220, 20, 60, 0.3)' },
        fluency: { backgroundColor: '#87CEEB', color: '#000000' },
        delete: { textDecoration: 'line-through', color: '#000000', fontWeight: 'bold' }
    };

    // Reset all category-related styles first to prevent style bleed from previous category
    element.style.color = '';
    element.style.backgroundColor = '';
    element.style.textDecoration = '';
    element.style.fontWeight = '';
    element.style.boxShadow = '';
    element.style.borderBottom = '';

    const style = categoryStyles[primaryCategory];
    if (style) {
        Object.assign(element.style, style);
    }

    // Check for multi-category - add visual indicator
    const categories = allCategories || (element.dataset.category ? element.dataset.category.split(',') : [primaryCategory]);
    if (categories.length > 1) {
        // Multi-category highlight: add dashed underline and box shadow to indicate multiple errors
        const secondaryCategory = categories[1];
        const secondaryStyle = categoryStyles[secondaryCategory];
        if (secondaryStyle) {
            const secondaryColor = secondaryStyle.color || '#666';
            element.style.borderBottom = `2px dashed ${secondaryColor}`;
            element.style.boxShadow = `inset 0 0 0 1px ${secondaryColor}`;
        }
    }
}

/**
 * Edit highlight functionality
 * @param {HTMLElement} markElement - Highlight element to edit
 */
function editHighlight(markElement) {
    // Get current categories
    const categories = (markElement.dataset.category || '').split(',').filter(c => c.trim());

    // Show highlight edit modal
    showHighlightEditModal(markElement, categories);
}

/**
 * Edit highlight for batch essays
 * @param {HTMLElement} element - Highlight element
 * @param {number} essayIndex - Essay index
 */
function editBatchHighlight(element, essayIndex) {
    // Similar to editHighlight but with batch-specific handling
    editHighlight(element);
}

/**
 * Show highlight edit modal
 * @param {HTMLElement} element - Highlight element
 * @param {Array} currentCategories - Current categories
 */
function showHighlightEditModal(element, currentCategories) {
    console.log('📝 Opening highlight edit modal for element:', element);

    // Ensure element has an ID
    if (!element.id) {
        element.id = `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log('🆔 Generated ID for element:', element.id);
    }

    // Use the new modal manager
    const modal = document.getElementById('editModal');
    const modalCategoryButtons = document.getElementById('modalCategoryButtons');
    const correctionTextarea = document.getElementById('editCorrection');
    const explanationTextarea = document.getElementById('editExplanation');
    const highlightedTextDisplay = document.getElementById('highlightedTextDisplay');

    if (!modal || !modalCategoryButtons || !correctionTextarea) {
        console.error('Edit modal elements not found');
        return;
    }

    // Display the highlighted text
    if (highlightedTextDisplay) {
        const originalText = element.dataset.originalText || element.textContent || '';
        highlightedTextDisplay.textContent = originalText;
    }

    // COMPLETE modal reset to prevent any interference between highlights
    modal.dataset.selectedCategories = '';
    modal.dataset.editingElement = '';

    // Clear any lingering button states from previous edits
    modal.querySelectorAll('.modal-category-btn').forEach(btn => {
        btn.classList.remove('modal-category-selected');
        btn.style.backgroundColor = '';
        btn.style.color = '';
        const checkmark = btn.querySelector('.checkmark');
        if (checkmark) {
            checkmark.remove();
        }
    });

    // Set current categories for this specific edit session
    modal.dataset.selectedCategories = currentCategories.join(',');

    // Store reference to the element being edited (AFTER clearing state)
    modal.dataset.editingElement = element.id;
    console.log('✅ Stored editing element ID:', element.id);

    // Clear any previous category button states
    modal.querySelectorAll('.modal-category-btn').forEach(btn => {
        btn.classList.remove('modal-category-selected');
        const category = btn.dataset.category;
        const categoryData = getCategoryData(category);
        if (categoryData) {
            const isMechanics = category === 'mechanics';
            const isFluency = category === 'fluency';
            // Reset to default state
            btn.style.backgroundColor = (isMechanics || isFluency) ? categoryData.color : 'transparent';
            btn.style.color = (isMechanics || isFluency) ? 'black' : categoryData.color;
            // Remove any checkmarks
            const checkmark = btn.querySelector('.checkmark');
            if (checkmark) {
                checkmark.remove();
            }
        }
    });

    // Create category buttons
    const categories = [
        { id: 'grammar', name: 'Grammar Error', color: '#FF8C00' },
        { id: 'vocabulary', name: 'Vocabulary Error', color: '#00A36C' },
        { id: 'mechanics', name: 'Mechanics Error', color: '#D3D3D3' },
        { id: 'spelling', name: 'Spelling Error', color: '#DC143C' },
        { id: 'fluency', name: 'Fluency Error', color: '#87CEEB' },
        { id: 'delete', name: 'Delete Word', color: '#000000' }
    ];

    modalCategoryButtons.innerHTML = categories.map(category => {
        const isSelected = currentCategories.includes(category.id);
        const isMechanics = category.id === 'mechanics';
        const isFluency = category.id === 'fluency';
        const isDelete = category.id === 'delete';

        const bgColor = isSelected
            ? category.color
            : (isMechanics || isFluency ? category.color : 'transparent');
        const textColor = isSelected
            ? 'white'
            : (isMechanics || isFluency ? 'black' : category.color);
        const decoration = isDelete ? 'text-decoration: line-through;' : '';
        const selectedClass = isSelected ? 'modal-category-selected' : '';

        return `
            <button class="modal-category-btn ${selectedClass}" data-category="${category.id}"
                    style="background: ${bgColor}; color: ${textColor}; border: 3px solid ${category.color};
                           padding: 12px 20px; border-radius: 20px; cursor: pointer; font-weight: bold;
                           transition: all 0.2s; font-size: 16px; ${decoration}; position: relative;">
                ${category.name}
                ${isSelected ? '<span class="checkmark" style="position: absolute; top: -5px; right: -5px; background: #28a745; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">✓</span>' : ''}
            </button>
        `;
    }).join('');

    // Add click handlers to category buttons
    modalCategoryButtons.querySelectorAll('.modal-category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            toggleModalCategory(this.dataset.category);
        });
    });

    // Set correction and explanation from element data or empty
    const currentCorrection = element.dataset.correction || element.dataset.message || '';
    const currentExplanation = element.dataset.explanation || ''; // Don't fall back to notes - that contains correction
    correctionTextarea.value = currentCorrection;
    if (explanationTextarea) {
        explanationTextarea.value = currentExplanation;
    }

    // SIMPLIFIED APPROACH: Modal is display-only, category selection triggers immediate auto-save
    // Add handlers for all modal buttons - one-time setup to prevent duplicates

    // Close button (X)
    const closeButton = modal.querySelector('.modal-close-btn');
    if (closeButton && !closeButton.dataset.simpleHandlerAttached) {
        closeButton.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        closeButton.dataset.simpleHandlerAttached = 'true';
    }

    // Save button - saves both categories and notes
    const saveButton = modal.querySelector('.modal-save-btn');
    if (saveButton && !saveButton.dataset.simpleHandlerAttached) {
        saveButton.addEventListener('click', () => {
            const elementId = modal.dataset.editingElement;
            const element = document.getElementById(elementId);
            const selectedCategories = modal.dataset.selectedCategories ? modal.dataset.selectedCategories.split(',').filter(c => c.trim()) : [];

            if (element && selectedCategories.length > 0) {
                console.log('💾 Saving highlight with categories:', selectedCategories);

                // Save categories to element (update both data-category and data-type for compatibility)
                element.dataset.category = selectedCategories.join(',');
                element.dataset.type = selectedCategories[0]; // data-type stores primary category

                // Update className to match new primary category
                // Remove old highlight-* classes and add new one
                element.className = element.className.replace(/highlight-\w+/g, '').trim();
                element.classList.add(`highlight-${selectedCategories[0]}`);

                // Save correction and explanation to element
                const correctionTextarea = document.getElementById('editCorrection');
                const explanationTextarea = document.getElementById('editExplanation');

                console.log('🔍 Save Debug - Textarea Elements:', {
                    correctionTextarea: correctionTextarea,
                    correctionValue: correctionTextarea?.value,
                    correctionValueLength: correctionTextarea?.value?.length,
                    explanationTextarea: explanationTextarea,
                    explanationValue: explanationTextarea?.value,
                    explanationValueLength: explanationTextarea?.value?.length
                });

                if (correctionTextarea) {
                    element.dataset.correction = correctionTextarea.value;
                    element.dataset.message = correctionTextarea.value; // backwards compatibility
                    console.log('💾 Saved correction:', correctionTextarea.value);
                }
                if (explanationTextarea) {
                    element.dataset.explanation = explanationTextarea.value;
                    element.dataset.notes = explanationTextarea.value || correctionTextarea.value; // backwards compatibility
                    console.log('💾 Saved explanation:', explanationTextarea.value);
                }

                console.log('📦 Final dataset values:', {
                    correction: element.dataset.correction,
                    explanation: element.dataset.explanation,
                    message: element.dataset.message,
                    notes: element.dataset.notes
                });

                // Build tooltip showing both correction and explanation
                const correction = element.dataset.correction || '';
                const explanation = element.dataset.explanation || '';
                let tooltip = `Correction: ${correction || 'None'}`;
                if (explanation) {
                    tooltip += `\nExplanation: ${explanation}`;
                } else {
                    tooltip += `\nExplanation: None`;
                }
                element.title = tooltip;

                // Update visual styling (pass all categories for multi-error styling)
                console.log('🎨 Updating visual styling to:', selectedCategories);
                if (window.HighlightingModule && window.HighlightingModule.updateHighlightVisualStyling) {
                    window.HighlightingModule.updateHighlightVisualStyling(element, selectedCategories[0], selectedCategories);
                } else {
                    // Direct call as fallback
                    updateHighlightVisualStyling(element, selectedCategories[0], selectedCategories);
                }
                console.log('🎨 Style after update:', element.style.cssText);

                // Emit event for highlights section to refresh
                if (window.eventBus) {
                    console.log('Emitting highlight:updated event from highlighting.js');
                    window.eventBus.emit('highlight:updated', {
                        element,
                        categories: selectedCategories,
                        correction: element.dataset.correction,
                        explanation: element.dataset.explanation
                    });
                }

                console.log('✅ Save completed');
            }
            modal.style.display = 'none';

            // Auto-clear selection after saving to prevent accidentally re-opening editor
            if (window.getSelection) {
                window.getSelection().removeAllRanges();
            }
            // Also clear category selection state
            if (window.TextSelectionModule && window.TextSelectionModule.clearSelection) {
                window.TextSelectionModule.clearSelection();
            } else if (window.clearSelection) {
                window.clearSelection();
            }
            console.log('🧹 Cleared selection after highlight save');
        });
        saveButton.dataset.simpleHandlerAttached = 'true';
    }

    // Remove button - removes the highlight entirely
    const removeButton = modal.querySelector('.modal-remove-btn');
    if (removeButton && !removeButton.dataset.simpleHandlerAttached) {
        removeButton.addEventListener('click', () => {
            const elementId = modal.dataset.editingElement;
            const element = document.getElementById(elementId);
            if (element) {
                removeHighlight(element);
                console.log('🗑️ Highlight removed');
            }
            modal.style.display = 'none';
        });
        removeButton.dataset.simpleHandlerAttached = 'true';
    }

    // Cancel button - closes without any changes
    const cancelButton = modal.querySelector('.modal-cancel-btn');
    if (cancelButton && !cancelButton.dataset.simpleHandlerAttached) {
        cancelButton.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        cancelButton.dataset.simpleHandlerAttached = 'true';
    }

    // Show the modal using direct display method (highlighting modal has custom logic)
    console.log('📱 Opening highlight edit modal');
    modal.dataset.modalOpenTime = Date.now().toString();
    modal.style.display = 'block';
    modal.style.zIndex = '1000';

    // Ensure modal is visible and clickable
    const backdrop = modal.querySelector('.modal-content') || modal;
    if (backdrop) {
        backdrop.style.position = 'relative';
        backdrop.style.zIndex = '1001';
    }

    // Make modal draggable if draggable modal functionality is available
    if (window.DraggableModal && window.DraggableModal.makeDraggable) {
        window.DraggableModal.makeDraggable('editModal');
    }
}

/**
 * Toggle category selection in modal
 * @param {string} category - Category to toggle
 */
function toggleModalCategory(category) {
    const modal = document.getElementById('editModal');
    const selectedCategories = modal.dataset.selectedCategories ? modal.dataset.selectedCategories.split(',').filter(c => c.trim()) : [];

    // Toggle category
    const index = selectedCategories.indexOf(category);
    if (index > -1) {
        selectedCategories.splice(index, 1);
    } else {
        selectedCategories.push(category);
    }

    // Update stored categories
    modal.dataset.selectedCategories = selectedCategories.join(',');

    // Update categories in modal state only - do NOT auto-save or close
    // The user will manually click Save when ready
    console.log('🎯 Category toggled, modal remains open for notes editing');

    // Update button styles
    const categoryBtn = modal.querySelector(`[data-category="${category}"]`);
    if (categoryBtn) {
        const isSelected = selectedCategories.includes(category);
        const categories = [
            { id: 'grammar', color: '#FF8C00' },
            { id: 'vocabulary', color: '#00A36C' },
            { id: 'mechanics', color: '#D3D3D3' },
            { id: 'spelling', color: '#DC143C' },
            { id: 'fluency', color: '#87CEEB' },
            { id: 'delete', color: '#000000' }
        ];

        const categoryData = categories.find(c => c.id === category);
        if (categoryData) {
            const isMechanics = category === 'mechanics';
            const isFluency = category === 'fluency';

            if (isSelected) {
                categoryBtn.style.backgroundColor = categoryData.color;
                categoryBtn.style.color = 'white';
                categoryBtn.classList.add('modal-category-selected');
                // Add checkmark if not present
                if (!categoryBtn.querySelector('.checkmark')) {
                    categoryBtn.style.position = 'relative';
                    categoryBtn.innerHTML += '<span class="checkmark" style="position: absolute; top: -5px; right: -5px; background: #28a745; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">✓</span>';
                }
            } else {
                categoryBtn.style.backgroundColor = (isMechanics || isFluency) ? categoryData.color : 'transparent';
                categoryBtn.style.color = (isMechanics || isFluency) ? 'black' : categoryData.color;
                categoryBtn.classList.remove('modal-category-selected');
                // Remove checkmark if present
                const checkmark = categoryBtn.querySelector('.checkmark');
                if (checkmark) {
                    checkmark.remove();
                }
            }
        }
    }
}

/**
 * Remove highlight from element
 * @param {HTMLElement} element - Highlight element to remove
 */
function removeHighlight(element) {
    if (element && element.parentNode) {
        const parent = element.parentNode;
        const text = element.textContent;

        // Replace highlighted element with plain text
        const textNode = document.createTextNode(text);
        parent.replaceChild(textNode, element);

        // Normalize the parent to merge adjacent text nodes
        parent.normalize();

        // Emit event for highlight removal
        if (window.eventBus) {
            window.eventBus.emit('highlight:removed', { element, text });
        }
    }
}

/**
 * Remove highlight from the modal (called by remove button)
 * @deprecated Use ModalManager.removeHighlight() instead
 */
function removeHighlightFromModal() {
    console.warn('removeHighlightFromModal is deprecated. Use ModalManager.removeHighlight() instead.');
    if (window.ModalManager) {
        window.ModalManager.removeHighlight('editHighlight');
    }
}

/**
 * Get all highlights in a container
 * @param {HTMLElement} container - Container element
 * @returns {Array} Array of highlight elements
 */
function getAllHighlights(container = document) {
    return Array.from(container.querySelectorAll('mark[data-category]'));
}

/**
 * Get highlights by category
 * @param {string} category - Category to filter by
 * @param {HTMLElement} container - Container element
 * @returns {Array} Array of highlight elements
 */
function getHighlightsByCategory(category, container = document) {
    return Array.from(container.querySelectorAll(`mark[data-category="${category}"]`));
}

/**
 * Clear all highlights in a container
 * @param {HTMLElement} container - Container element
 */
function clearAllHighlights(container = document) {
    const highlights = getAllHighlights(container);
    highlights.forEach(highlight => removeHighlight(highlight));
}

/**
 * Migrate legacy highlights to new format
 * @param {HTMLElement} container - Container element
 */
function migrateLegacyHighlights(container = document) {
    // Find existing highlights that might need migration
    const existingHighlights = container.querySelectorAll('mark, span[data-category]');
    existingHighlights.forEach(element => {
        if (!element.dataset.category) {
            // Try to determine category from class name or styling
            const className = element.className;
            const category = mapLegacyCategory(className);
            if (category) {
                element.dataset.category = category;
                updateHighlightVisualStyling(element, category);
            }
        }

        // Ensure click handler is attached
        if (!element.onclick && !element.dataset.hasClickListener) {
            element.addEventListener('click', function(e) {
                e.stopPropagation();
                editHighlight(this);
            });
            element.dataset.hasClickListener = 'true';
            element.style.cursor = 'pointer';
        }
    });
}

/**
 * Ensure all highlights in container have click handlers
 * @param {HTMLElement} container - Container element
 */
function ensureHighlightClickHandlers(container = document) {
    const highlights = container.querySelectorAll('mark[data-category], mark.highlight');

    highlights.forEach((highlight, index) => {
        // Ensure highlight has required attributes
        if (!highlight.dataset.category) {
            // Try to extract category from class name
            const classMatch = highlight.className.match(/highlight-(\w+)/);
            if (classMatch) {
                highlight.dataset.category = classMatch[1];
            }
        }

        if (!highlight.dataset.hasClickListener) {
            highlight.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                editHighlight(this);
            });
            highlight.dataset.hasClickListener = 'true';
            highlight.style.cursor = 'pointer';
            // Build tooltip showing both correction and explanation
            const correction = highlight.dataset.correction || highlight.dataset.message || '';
            const explanation = highlight.dataset.explanation || '';
            let tooltip = `Correction: ${correction || 'None'}`;
            if (explanation) {
                tooltip += `\nExplanation: ${explanation}`;
            } else {
                tooltip += `\nExplanation: None`;
            }
            highlight.title = tooltip;
        }
    });
}

/**
 * Map legacy category names to current format
 * @param {string} oldCategory - Old category name or class
 * @returns {string} New category name
 */
function mapLegacyCategory(oldCategory) {
    const mapping = {
        'highlight-grammar': 'grammar',
        'highlight-vocabulary': 'vocabulary',
        'highlight-mechanics': 'mechanics',
        'highlight-spelling': 'spelling',
        'highlight-fluency': 'fluency',
        'highlight-delete': 'delete',
        // Add more mappings as needed
    };
    return mapping[oldCategory] || oldCategory;
}

/**
 * Export highlights data for saving/loading
 * @param {HTMLElement} container - Container element
 * @returns {Array} Array of highlight data objects
 */
function exportHighlightsData(container = document) {
    const highlights = getAllHighlights(container);
    return highlights.map(highlight => ({
        id: highlight.id,
        category: highlight.dataset.category,
        originalText: highlight.dataset.originalText,
        notes: highlight.dataset.notes || '',
        position: getElementTextPosition(highlight)
    }));
}

/**
 * Import highlights data and apply to text
 * @param {Array} highlightsData - Array of highlight data objects
 * @param {HTMLElement} container - Container element
 */
function importHighlightsData(highlightsData, container = document) {
    highlightsData.forEach(data => {
        // Implementation would need to find text positions and apply highlights
        // This is complex and would require text range calculation
        console.log('Importing highlight:', data);
    });
}

/**
 * Get text position of an element within its container
 * @param {HTMLElement} element - Element to get position for
 * @returns {Object} Position object with start and end offsets
 */
function getElementTextPosition(element) {
    const container = element.closest('.formatted-essay-content');
    if (!container) return null;

    const range = document.createRange();
    range.selectNodeContents(container);

    const preCaretRange = range.cloneRange();
    preCaretRange.setEnd(element, 0);
    const start = preCaretRange.toString().length;

    const elementRange = range.cloneRange();
    elementRange.selectNodeContents(element);
    const end = start + elementRange.toString().length;

    return { start, end };
}

// Export functions for module usage
window.HighlightingModule = {
    applyHighlight,
    applyBatchHighlight,
    updateHighlightVisualStyling,
    editHighlight,
    editBatchHighlight,
    showHighlightEditModal,
    removeHighlight,
    removeHighlightFromModal,
    toggleModalCategory,
    getAllHighlights,
    getHighlightsByCategory,
    clearAllHighlights,
    migrateLegacyHighlights,
    ensureHighlightClickHandlers,
    mapLegacyCategory,
    exportHighlightsData,
    importHighlightsData,
    getElementTextPosition
};