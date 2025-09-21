/**
 * Category Selection Module
 * Handles category selection for highlighting functionality
 */

/**
 * Setup category buttons for single essays
 */
function setupCategoryButtons() {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            selectCategory(this.dataset.category);
        });
    });
}

/**
 * Setup category buttons for batch essays
 * @param {number} essayIndex - Essay index
 */
function setupBatchCategoryButtons(essayIndex) {
    document.querySelectorAll(`.category-btn[data-essay-index="${essayIndex}"]`).forEach(btn => {
        btn.addEventListener('click', function() {
            selectBatchCategory(this.dataset.category, essayIndex);
        });
    });
}

/**
 * Select a category for highlighting
 * @param {string} category - Category name
 */
function selectCategory(category) {
    // Update text selection module
    if (window.TextSelectionModule) {
        window.TextSelectionModule.setSelectedCategory(category);
    }

    // Update button styles
    document.querySelectorAll('.category-btn').forEach(btn => {
        if (btn.dataset.category === category) {
            // Toggle behavior: if already selected, deselect
            if (btn.classList.contains('selected')) {
                // Deselect - reset to original colors
                const originalColor = getOriginalCategoryColor(btn.dataset.category);
                btn.style.backgroundColor = originalColor.background;
                btn.style.color = originalColor.color;
                btn.classList.remove('selected');
                // Remove checkmark if present
                const checkmark = btn.querySelector('.checkmark');
                if (checkmark) {
                    checkmark.remove();
                }
                if (window.TextSelectionModule) {
                    window.TextSelectionModule.setSelectedCategory(null);
                    window.TextSelectionModule.updateSelectionStatus('Category deselected. Select a category to highlight text.');
                }
            } else {
                // Select - use category color as background
                const categoryColor = getOriginalCategoryColor(btn.dataset.category);
                btn.style.backgroundColor = categoryColor.color;
                btn.style.color = 'white';
                btn.classList.add('selected');
                btn.style.position = 'relative';
                // Add checkmark if not present
                if (!btn.querySelector('.checkmark')) {
                    btn.innerHTML += '<span class="checkmark" style="position: absolute; top: -5px; right: -5px; background: #28a745; color: white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;">✓</span>';
                }
                if (window.TextSelectionModule) {
                    window.TextSelectionModule.updateSelectionStatus(`Selected category: ${category}. Now highlight text to apply.`);
                }
            }
        } else {
            // Reset other buttons to original style
            const originalColor = getOriginalCategoryColor(btn.dataset.category);
            btn.style.backgroundColor = originalColor.background;
            btn.style.color = originalColor.color;
            btn.classList.remove('selected');
            // Remove checkmark if present
            const checkmark = btn.querySelector('.checkmark');
            if (checkmark) {
                checkmark.remove();
            }
        }
    });

    // Apply to current selection if any (only if a category is selected)
    const selectedBtn = document.querySelector('.category-btn.selected');
    if (selectedBtn) {
        const currentRange = window.TextSelectionModule ? window.TextSelectionModule.getCurrentSelection() : null;
        if (currentRange) {
            window.TextSelectionModule.applyHighlightToSelection();
        }
    }
}

/**
 * Select category for batch essays
 * @param {string} category - Category name
 * @param {number} essayIndex - Essay index
 */
function selectBatchCategory(category, essayIndex) {
    // Update text selection module
    if (window.TextSelectionModule) {
        window.TextSelectionModule.setSelectedCategory(category, essayIndex);
    }

    // Update button styles for this specific essay
    document.querySelectorAll(`.category-btn[data-essay-index="${essayIndex}"]`).forEach(btn => {
        if (btn.dataset.category === category) {
            // Toggle behavior: if already selected, deselect
            if (btn.classList.contains('selected')) {
                // Deselect - reset to original colors
                const originalColor = getOriginalCategoryColor(btn.dataset.category);
                btn.style.backgroundColor = originalColor.background;
                btn.style.color = originalColor.color;
                btn.classList.remove('selected');
                // Remove checkmark if present
                const checkmark = btn.querySelector('.checkmark');
                if (checkmark) {
                    checkmark.remove();
                }
                if (window.TextSelectionModule) {
                    window.TextSelectionModule.setSelectedCategory(null, essayIndex);
                    window.TextSelectionModule.updateBatchSelectionStatus(essayIndex, 'Category deselected. Select a category to highlight text.');
                }
            } else {
                // Select - use category color as background
                const categoryColor = getOriginalCategoryColor(btn.dataset.category);
                btn.style.backgroundColor = categoryColor.color;
                btn.style.color = 'white';
                btn.classList.add('selected');
                btn.style.position = 'relative';
                // Add checkmark if not present
                if (!btn.querySelector('.checkmark')) {
                    btn.innerHTML += '<span class="checkmark" style="position: absolute; top: -5px; right: -5px; background: #28a745; color: white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;">✓</span>';
                }
                if (window.TextSelectionModule) {
                    window.TextSelectionModule.updateBatchSelectionStatus(essayIndex, `Selected category: ${category}. Now highlight text to apply.`);
                }
            }
        } else {
            // Reset other buttons to original style
            const originalColor = getOriginalCategoryColor(btn.dataset.category);
            btn.style.backgroundColor = originalColor.background;
            btn.style.color = originalColor.color;
            btn.classList.remove('selected');
            // Remove checkmark if present
            const checkmark = btn.querySelector('.checkmark');
            if (checkmark) {
                checkmark.remove();
            }
        }
    });

    // Apply to current selection if any (only if a category is selected)
    const selectedBtn = document.querySelector(`.category-btn[data-essay-index="${essayIndex}"].selected`);
    if (selectedBtn) {
        const currentRange = window.TextSelectionModule ? window.TextSelectionModule.getCurrentSelection(essayIndex) : null;
        if (currentRange) {
            window.TextSelectionModule.applyBatchHighlightToSelection(essayIndex);
        }
    }
}

/**
 * Get original category color styling
 * @param {string} category - Category name
 * @returns {Object} Color styling object
 */
function getOriginalCategoryColor(category) {
    const colorMap = {
        grammar: { background: 'transparent', color: '#FF8C00' },
        vocabulary: { background: 'transparent', color: '#00A36C' },
        mechanics: { background: '#D3D3D3', color: '#000000' },
        spelling: { background: 'transparent', color: '#DC143C' },
        fluency: { background: '#87CEEB', color: '#000000' },
        delete: { background: 'transparent', color: '#000000' }
    };
    return colorMap[category] || { background: 'transparent', color: '#000000' };
}

/**
 * Clear category selection for single essays
 */
function clearCategorySelection() {
    document.querySelectorAll('.category-btn').forEach(btn => {
        const originalColor = getOriginalCategoryColor(btn.dataset.category);
        btn.style.backgroundColor = originalColor.background;
        btn.style.color = originalColor.color;
    });
}

/**
 * Clear category selection for batch essays
 * @param {number} essayIndex - Essay index
 */
function clearBatchCategorySelection(essayIndex) {
    document.querySelectorAll(`.category-btn[data-essay-index="${essayIndex}"]`).forEach(btn => {
        const originalColor = getOriginalCategoryColor(btn.dataset.category);
        btn.style.backgroundColor = originalColor.background;
        btn.style.color = originalColor.color;
    });
}

/**
 * Get all available categories
 * @returns {Array} Array of category objects
 */
function getAvailableCategories() {
    return [
        { id: 'grammar', name: 'Grammar Error', color: '#FF8C00' },
        { id: 'vocabulary', name: 'Vocabulary Error', color: '#00A36C' },
        { id: 'mechanics', name: 'Mechanics Error', color: '#D3D3D3' },
        { id: 'spelling', name: 'Spelling Error', color: '#DC143C' },
        { id: 'fluency', name: 'Fluency Error', color: '#87CEEB' },
        { id: 'delete', name: 'Delete Word', color: '#000000' }
    ];
}

/**
 * Create category buttons HTML
 * @param {string} essayIndex - Optional essay index for batch processing
 * @returns {string} HTML string for category buttons
 */
function createCategoryButtons(essayIndex = '') {
    const dataAttr = essayIndex ? ` data-essay-index="${essayIndex}"` : '';
    const categories = getAvailableCategories();

    return categories.map(category => {
        const isDelete = category.id === 'delete';
        const isMechanics = category.id === 'mechanics';
        const isFluency = category.id === 'fluency';

        const bgColor = isMechanics || isFluency ? category.color : 'transparent';
        const textColor = isMechanics || isFluency ? 'black' : category.color;
        const decoration = isDelete ? 'text-decoration: line-through;' : '';

        return `
            <button class="category-btn" data-category="${category.id}"${dataAttr}
                    style="background: ${bgColor}; color: ${textColor}; border: 2px solid ${category.color};
                           padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold;
                           transition: all 0.2s; ${decoration}">
                ${category.name}
            </button>
        `;
    }).join('');
}

/**
 * Initialize category selection for specific container
 * @param {string} containerId - Container element ID
 * @param {number} essayIndex - Optional essay index for batch essays
 */
function initializeCategorySelection(containerId, essayIndex = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const buttonsHTML = createCategoryButtons(essayIndex || '');
    container.innerHTML = buttonsHTML + (essayIndex !== null ?
        `<button id="clearSelectionBtn-${essayIndex}" onclick="clearSelection(${essayIndex})" style="background: #f5f5f5; color: #666; border: 2px solid #ccc; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-left: 10px;">Clear Selection</button>` :
        `<button id="clearSelectionBtn" onclick="clearSelection()" style="background: #f5f5f5; color: #666; border: 2px solid #ccc; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-left: 10px;">Clear Selection</button>`
    );

    // Setup event listeners
    if (essayIndex !== null) {
        setupBatchCategoryButtons(essayIndex);
    } else {
        setupCategoryButtons();
    }
}

// Export functions for module usage
window.CategorySelectionModule = {
    setupCategoryButtons,
    setupBatchCategoryButtons,
    selectCategory,
    selectBatchCategory,
    getOriginalCategoryColor,
    clearCategorySelection,
    clearBatchCategorySelection,
    getAvailableCategories,
    createCategoryButtons,
    initializeCategorySelection
};