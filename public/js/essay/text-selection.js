/**
 * Text Selection Module
 * Handles text selection functionality for single and batch essays
 */

// Global state for text selection
let selectedRange = null;
let selectedCategory = null;

/**
 * Setup text selection handling for single essays
 */
function setupTextSelection() {
    const essayContent = document.querySelector('.formatted-essay-content');
    if (essayContent) {
        essayContent.addEventListener('mouseup', handleTextSelection);
    }
}

/**
 * Setup text selection handling for batch essays
 * @param {number} essayIndex - Essay index
 */
function setupBatchTextSelection(essayIndex) {
    const essayContent = document.querySelector(`.formatted-essay-content[data-essay-index="${essayIndex}"]`);
    if (essayContent) {
        essayContent.addEventListener('mouseup', (e) => handleBatchTextSelection(e, essayIndex));
    }
}

/**
 * Handle text selection in essay content
 * @param {Event} e - Mouse event
 */
function handleTextSelection(e) {
    console.log('🖱️ Text selection event triggered');
    const selection = window.getSelection();

    if (!selection.rangeCount || selection.isCollapsed) {
        console.log('❌ No selection or selection collapsed');
        selectedRange = null;
        updateSelectionStatus('');
        return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = range.toString().trim();
    console.log('✅ Text selected:', selectedText);

    if (selectedText) {
        selectedRange = range;
        updateSelectionStatus(`Selected: "${selectedText}". Choose a category to apply highlighting.`);
        console.log('📝 Selection stored and status updated');

        // Auto-apply if category is already selected
        if (selectedCategory) {
            console.log('🎯 Auto-applying highlight with category:', selectedCategory);
            applyHighlightToSelection();
        } else {
            console.log('⏳ Waiting for category selection...');
        }
    }
}

/**
 * Handle text selection for batch essays
 * @param {Event} e - Mouse event
 * @param {number} essayIndex - Essay index
 */
function handleBatchTextSelection(e, essayIndex) {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) {
        window[`selectedRange_${essayIndex}`] = null;
        updateBatchSelectionStatus(essayIndex, '');
        return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = range.toString().trim();

    if (selectedText) {
        window[`selectedRange_${essayIndex}`] = range;
        updateBatchSelectionStatus(essayIndex, `Selected: "${selectedText}". Choose a category to apply highlighting.`);

        // Auto-apply if category is already selected
        const currentCategory = window[`selectedCategory_${essayIndex}`];
        if (currentCategory) {
            applyBatchHighlightToSelection(essayIndex);
        }
    }
}

/**
 * Apply highlighting to current selection
 */
function applyHighlightToSelection() {
    console.log('🎨 Applying highlight to selection...');
    console.log('Range:', selectedRange);
    console.log('Category:', selectedCategory);

    if (!selectedRange || !selectedCategory) {
        console.log('❌ Missing range or category');
        return;
    }

    const selectedText = selectedRange.toString().trim();
    console.log('Selected text:', selectedText);

    if (window.HighlightingModule) {
        console.log('✅ HighlightingModule found, applying highlight');
        window.HighlightingModule.applyHighlight(selectedRange, selectedText, selectedCategory);
    } else {
        console.log('❌ HighlightingModule not found!');
        return;
    }

    // Clear selection
    window.getSelection().removeAllRanges();
    selectedRange = null;
    updateSelectionStatus('Highlight applied successfully.');
    console.log('✅ Highlight applied and selection cleared');
}

/**
 * Apply highlighting for batch essays
 * @param {number} essayIndex - Essay index
 */
function applyBatchHighlightToSelection(essayIndex) {
    const range = window[`selectedRange_${essayIndex}`];
    const category = window[`selectedCategory_${essayIndex}`];

    if (!range || !category) return;

    const selectedText = range.toString().trim();
    if (window.HighlightingModule) {
        window.HighlightingModule.applyBatchHighlight(range, selectedText, category, essayIndex);
    }

    // Clear selection
    window.getSelection().removeAllRanges();
    window[`selectedRange_${essayIndex}`] = null;
    updateBatchSelectionStatus(essayIndex, 'Highlight applied successfully.');
}

/**
 * Clear current selection
 * @param {number} essayIndex - Optional essay index for batch essays
 */
function clearSelection(essayIndex) {
    if (essayIndex !== undefined) {
        // Clear batch selection
        window[`selectedRange_${essayIndex}`] = null;
        window[`selectedCategory_${essayIndex}`] = null;
        updateBatchSelectionStatus(essayIndex, '');

        // Reset category buttons
        if (window.CategorySelectionModule) {
            window.CategorySelectionModule.clearBatchCategorySelection(essayIndex);
        }
    } else {
        // Clear single essay selection
        selectedRange = null;
        selectedCategory = null;
        updateSelectionStatus('');

        // Reset category buttons
        if (window.CategorySelectionModule) {
            window.CategorySelectionModule.clearCategorySelection();
        }
    }

    // Clear browser selection
    window.getSelection().removeAllRanges();
}

/**
 * Update selection status message
 * @param {string} message - Status message
 */
function updateSelectionStatus(message) {
    const statusElement = document.getElementById('selectionStatus');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

/**
 * Update selection status for batch essays
 * @param {number} essayIndex - Essay index
 * @param {string} message - Status message
 */
function updateBatchSelectionStatus(essayIndex, message) {
    const statusElement = document.getElementById(`selectionStatus-${essayIndex}`);
    if (statusElement) {
        statusElement.textContent = message;
    }
}

/**
 * Get current selection range
 * @param {number} essayIndex - Optional essay index for batch essays
 * @returns {Range|null} Current selection range
 */
function getCurrentSelection(essayIndex) {
    if (essayIndex !== undefined) {
        return window[`selectedRange_${essayIndex}`] || null;
    }
    return selectedRange;
}

/**
 * Set selected category for highlighting
 * @param {string} category - Category name
 * @param {number} essayIndex - Optional essay index for batch essays
 */
function setSelectedCategory(category, essayIndex) {
    console.log('🏷️ Setting selected category:', category, 'essayIndex:', essayIndex);

    if (essayIndex !== undefined) {
        window[`selectedCategory_${essayIndex}`] = category;
        selectedCategory = category; // Keep global in sync
        console.log('✅ Batch category set:', window[`selectedCategory_${essayIndex}`]);
    } else {
        selectedCategory = category;
        console.log('✅ Global category set:', selectedCategory);
    }

    // If we have a selection and a category, auto-apply
    const currentRange = essayIndex !== undefined ? window[`selectedRange_${essayIndex}`] : selectedRange;
    if (currentRange && category) {
        console.log('🚀 Auto-applying highlight with both selection and category available');
        if (essayIndex !== undefined) {
            applyBatchHighlightToSelection(essayIndex);
        } else {
            applyHighlightToSelection();
        }
    }
}

/**
 * Get current selected category
 * @param {number} essayIndex - Optional essay index for batch essays
 * @returns {string|null} Current selected category
 */
function getSelectedCategory(essayIndex) {
    if (essayIndex !== undefined) {
        return window[`selectedCategory_${essayIndex}`] || null;
    }
    return selectedCategory;
}

// Export functions for module usage
window.TextSelectionModule = {
    setupTextSelection,
    setupBatchTextSelection,
    handleTextSelection,
    handleBatchTextSelection,
    applyHighlightToSelection,
    applyBatchHighlightToSelection,
    clearSelection,
    updateSelectionStatus,
    updateBatchSelectionStatus,
    getCurrentSelection,
    setSelectedCategory,
    getSelectedCategory
};