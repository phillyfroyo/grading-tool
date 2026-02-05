/**
 * Essay Editing Main Module
 * Main controller for essay editing functionality, integrates all essay editing modules
 */

/**
 * Initialize essay editing for single essays
 */
function initializeEssayEditing() {
    console.log('🔧 Initializing essay editing...');

    // Setup text selection
    if (window.TextSelectionModule) {
        window.TextSelectionModule.setupTextSelection();
    }

    // Setup category selection
    if (window.CategorySelectionModule) {
        window.CategorySelectionModule.setupCategoryButtons();
    }

    // Migrate legacy highlights
    if (window.HighlightingModule) {
        window.HighlightingModule.migrateLegacyHighlights();
    }

    console.log('✅ Essay editing initialized');
}

/**
 * Initialize essay editing for batch essays
 * @param {number} essayIndex - Essay index for batch processing
 * @param {Object} gradingResult - Grading result object
 * @param {Object} originalData - Original essay data
 */
function initializeBatchEssayEditing(essayIndex, gradingResult, originalData) {
    // Setup batch text selection
    if (window.TextSelectionModule) {
        window.TextSelectionModule.setupBatchTextSelection(essayIndex);
    }

    // Setup batch category selection
    if (window.CategorySelectionModule) {
        window.CategorySelectionModule.setupBatchCategoryButtons(essayIndex);
    }

    // Store essay-specific data for editing
    window[`batchGradingData_${essayIndex}`] = { gradingResult, originalData };
}

/**
 * Select a category for highlighting
 * @param {string} category - Category name
 * @param {number} essayIndex - Optional essay index for batch essays
 */
function selectCategory(category, essayIndex) {
    if (essayIndex !== undefined) {
        if (window.CategorySelectionModule) {
            window.CategorySelectionModule.selectBatchCategory(category, essayIndex);
        }
    } else {
        if (window.CategorySelectionModule) {
            window.CategorySelectionModule.selectCategory(category);
        }
    }
}

/**
 * Clear current selection
 * @param {number} essayIndex - Optional essay index for batch essays
 */
function clearSelection(essayIndex) {
    if (window.TextSelectionModule) {
        window.TextSelectionModule.clearSelection(essayIndex);
    }
}

/**
 * Apply highlight to selected text
 * @param {Range} range - Selection range
 * @param {string} text - Selected text
 * @param {string} category - Highlight category
 * @param {number} essayIndex - Optional essay index for batch essays
 */
function applyHighlight(range, text, category, essayIndex) {
    if (window.HighlightingModule) {
        if (essayIndex !== undefined) {
            window.HighlightingModule.applyBatchHighlight(range, text, category, essayIndex);
        } else {
            window.HighlightingModule.applyHighlight(range, text, category);
        }
    }
}

/**
 * Edit highlight functionality
 * @param {HTMLElement} markElement - Highlight element to edit
 * @param {number} essayIndex - Optional essay index for batch essays
 */
function editHighlight(markElement, essayIndex) {
    if (window.HighlightingModule) {
        if (essayIndex !== undefined) {
            window.HighlightingModule.editBatchHighlight(markElement, essayIndex);
        } else {
            window.HighlightingModule.editHighlight(markElement);
        }
    }
}

/**
 * Update highlight visual styling
 * @param {HTMLElement} element - Highlight element
 * @param {string} category - Category name
 */
function updateHighlightVisualStyling(element, category) {
    if (window.HighlightingModule) {
        window.HighlightingModule.updateHighlightVisualStyling(element, category);
    }
}

/**
 * Format essay text for display
 * @param {string} text - Raw essay text
 * @returns {string} Formatted HTML
 */
function formatEssayText(text) {
    if (window.EssayFormatterModule) {
        return window.EssayFormatterModule.formatEssayText(text);
    }

    // Fallback formatting
    return text
        .split('\n\n')
        .filter(paragraph => paragraph.trim())
        .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
        .join('');
}

/**
 * Get essay statistics
 * @param {string} text - Essay text
 * @returns {Object} Statistics object
 */
function getEssayStatistics(text) {
    if (window.EssayFormatterModule) {
        return window.EssayFormatterModule.getTextStatistics(text);
    }

    // Fallback statistics
    const wordCount = text ? text.trim().split(/\s+/).filter(word => word.length > 0).length : 0;
    return { words: wordCount };
}

/**
 * Export all highlights in current essay
 * @param {HTMLElement} container - Container element
 * @returns {Array} Array of highlight data
 */
function exportHighlights(container) {
    if (window.HighlightingModule) {
        return window.HighlightingModule.exportHighlightsData(container);
    }
    return [];
}

/**
 * Import highlights into essay
 * @param {Array} highlightsData - Highlight data array
 * @param {HTMLElement} container - Container element
 */
function importHighlights(highlightsData, container) {
    if (window.HighlightingModule) {
        window.HighlightingModule.importHighlightsData(highlightsData, container);
    }
}

/**
 * Setup essay editing for a specific container
 * @param {string} containerId - Container element ID
 * @param {Object} options - Configuration options
 */
function setupEssayContainer(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }

    const {
        batchIndex = null,
        enableHighlighting = true,
        enableCategorySelection = true,
        enableTextSelection = true
    } = options;

    // Setup category buttons if enabled
    if (enableCategorySelection && window.CategorySelectionModule) {
        const categoryContainer = container.querySelector('.category-buttons');
        if (categoryContainer) {
            window.CategorySelectionModule.initializeCategorySelection(categoryContainer.id, batchIndex);
        }
    }

    // Setup text selection if enabled
    if (enableTextSelection && window.TextSelectionModule) {
        if (batchIndex !== null) {
            window.TextSelectionModule.setupBatchTextSelection(batchIndex);
        } else {
            window.TextSelectionModule.setupTextSelection();
        }
    }

    // Migrate existing highlights
    if (enableHighlighting && window.HighlightingModule) {
        window.HighlightingModule.migrateLegacyHighlights(container);
    }
}

/**
 * Cleanup essay editing for a container
 * @param {string} containerId - Container element ID
 */
function cleanupEssayContainer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Remove event listeners (this is complex, would need to track them)
    // For now, just clear highlights
    if (window.HighlightingModule) {
        window.HighlightingModule.clearAllHighlights(container);
    }
}

/**
 * Get essay editing status
 * @param {string} containerId - Container element ID
 * @returns {Object} Status object
 */
function getEssayEditingStatus(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return { initialized: false };

    const highlights = window.HighlightingModule ?
        window.HighlightingModule.getAllHighlights(container) : [];

    const selectedCategory = window.TextSelectionModule ?
        window.TextSelectionModule.getSelectedCategory() : null;

    const currentSelection = window.TextSelectionModule ?
        window.TextSelectionModule.getCurrentSelection() : null;

    return {
        initialized: true,
        highlightCount: highlights.length,
        selectedCategory: selectedCategory,
        hasSelection: !!currentSelection,
        containerId: containerId
    };
}

// Backward compatibility: expose functions globally for existing code
window.initializeEssayEditing = initializeEssayEditing;
window.initializeBatchEssayEditing = initializeBatchEssayEditing;
window.selectCategory = selectCategory;
window.clearSelection = clearSelection;
window.applyHighlight = applyHighlight;
window.editHighlight = editHighlight;
window.updateHighlightVisualStyling = updateHighlightVisualStyling;
window.formatEssayText = formatEssayText;

// Export main module
window.EssayEditingModule = {
    initializeEssayEditing,
    initializeBatchEssayEditing,
    selectCategory,
    clearSelection,
    applyHighlight,
    editHighlight,
    updateHighlightVisualStyling,
    formatEssayText,
    getEssayStatistics,
    exportHighlights,
    importHighlights,
    setupEssayContainer,
    cleanupEssayContainer,
    getEssayEditingStatus
};