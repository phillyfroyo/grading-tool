/**
 * Single Result Module
 * Handles display and management of single essay grading results
 */

// Global state for current grading data
let currentGradingData = null;
let currentOriginalData = null;

// Track grading data for multiple essays in batch processing
let batchGradingData = {};

/**
 * Display results for a single essay
 * @param {Object} gradingResult - The grading result from the server
 * @param {Object} originalData - The original form data
 */
function displayResults(gradingResult, originalData) {
    console.log('🎯 DISPLAY RESULTS CALLED');
    console.log('Grading result:', gradingResult);
    console.log('Original data:', originalData);

    // Clear any batch data when displaying single results
    batchGradingData = {};
    console.log('🧹 Cleared batch grading data for single essay display');

    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;

    // Show loading state
    resultsDiv.innerHTML = window.DisplayUtilsModule ?
        window.DisplayUtilsModule.createLoadingSpinner('Formatting essay...') :
        '<div class="loading">Formatting essay...</div>';
    resultsDiv.style.display = 'block';

    console.log('📤 MAKING FORMAT REQUEST...');
    // Format the essay with color coding
    fetch('/format', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            studentText: originalData.studentText,
            gradingResults: gradingResult,
            studentName: originalData.studentName,
            editable: true
        })
    })
    .then(response => {
        console.log('📥 FORMAT RESPONSE STATUS:', response.status);
        return response.json();
    })
    .then(formatted => {
        console.log('✅ FORMAT RESPONSE RECEIVED:', formatted);
        const studentName = originalData.studentName || 'Student';

        const essayHTML = window.DisplayUtilsModule ?
            window.DisplayUtilsModule.createSingleEssayHTML(studentName, formatted) :
            createSingleEssayHTMLFallback(studentName, formatted);

        resultsDiv.innerHTML = essayHTML;
        resultsDiv.style.display = 'block';

        // Add event listeners for editable elements
        setupEditableElements(gradingResult, originalData);

        // Initialize essay editing
        setTimeout(() => {
            if (window.EssayEditingModule) {
                window.EssayEditingModule.initializeEssayEditing();
            }

            // Ensure all existing highlights have click handlers for modal reopening
            if (window.HighlightingModule) {
                window.HighlightingModule.ensureHighlightClickHandlers();
            }
        }, 100);
    })
    .catch(error => {
        console.error('Formatting error:', error);
        const errorHTML = window.DisplayUtilsModule ?
            window.DisplayUtilsModule.createErrorHTML('Error formatting results', error.message) :
            '<div class="error">Error formatting results.</div>';
        resultsDiv.innerHTML = errorHTML;
        resultsDiv.style.display = 'block';
    });
}

/**
 * Setup editable elements for single essay results
 * @param {Object} gradingResult - Grading result object
 * @param {Object} originalData - Original form data
 */
function setupEditableElements(gradingResult, originalData) {
    currentGradingData = { ...gradingResult };
    currentOriginalData = { ...originalData };

    console.log('🔧 Setting up editable elements for single essay');

    // Add listeners for score inputs (only if not already added)
    document.querySelectorAll('.editable-score:not([data-listener-added])').forEach(input => {
        input.dataset.listenerAdded = 'true';

        input.addEventListener('input', function() {
            const category = this.dataset.category;
            const newPoints = parseFloat(this.value) || 0;
            const maxPoints = parseFloat(this.max) || 15;

            console.log('📝 Single essay score changed:', { category, newPoints });

            // Validate range
            if (newPoints < 0) this.value = 0;
            if (newPoints > maxPoints) this.value = maxPoints;

            // Update data
            if (currentGradingData.scores && currentGradingData.scores[category]) {
                currentGradingData.scores[category].points = parseFloat(this.value);
            }

            // Recalculate total score
            updateTotalScore();
        });
    });

    // Add listeners for arrow click areas (only if not already added)
    document.querySelectorAll('.arrow-up-area:not([data-listener-added]), .arrow-down-area:not([data-listener-added])').forEach(arrow => {
        arrow.dataset.listenerAdded = 'true';
        arrow.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent event bubbling
            e.preventDefault(); // Prevent default behavior

            const input = this.parentElement.querySelector('.editable-score');
            if (input) {
                // Store current value
                const currentValue = parseFloat(input.value) || 0;
                const max = parseFloat(input.max) || 15;
                const min = parseFloat(input.min) || 0;

                // Calculate new value (increment by 1)
                let newValue;
                if (this.classList.contains('arrow-up-area')) {
                    newValue = Math.min(currentValue + 1, max);
                } else if (this.classList.contains('arrow-down-area')) {
                    newValue = Math.max(currentValue - 1, min);
                }

                // Set the new value and let the input event handler take care of the rest
                if (newValue !== currentValue) {
                    input.value = newValue;

                    // Trigger input event to let existing listeners handle the update
                    input.dispatchEvent(new Event('input'));

                    console.log('⬆️⬇️ Arrow clicked, new value:', newValue);
                }
            }
        });
    });

    // Setup editing functions integration
    if (window.EditingFunctionsModule) {
        window.EditingFunctionsModule.setupEditableElements();
    }

    // Setup category note toggle listeners (for auto-filled rationales)
    // Use setTimeout to ensure DOM is fully ready
    setTimeout(() => {
        if (window.setupCategoryNoteToggleListeners) {
            window.setupCategoryNoteToggleListeners();
        }
    }, 50);
}

/**
 * Setup editable elements for batch essay results
 * @param {Object} gradingResult - Grading result object
 * @param {Object} originalData - Original form data
 * @param {number} essayIndex - Essay index for batch processing
 */
function setupBatchEditableElements(gradingResult, originalData, essayIndex) {
    // Clear single essay data when setting up batch
    if (essayIndex === 0) {
        currentGradingData = null;
        currentOriginalData = null;
    }

    // Store data for this specific essay index
    batchGradingData[essayIndex] = {
        gradingData: { ...gradingResult },
        originalData: { ...originalData }
    };

    // Add listeners for score inputs within the specific essay container
    const essayContainer = document.getElementById(`batch-essay-${essayIndex}`);
    if (essayContainer) {
        // Check if we've already set up listeners for this container
        if (essayContainer.dataset.listenersAttached === 'true') {
            return;
        }

        // Mark that we're attaching listeners
        essayContainer.dataset.listenersAttached = 'true';
        essayContainer.dataset.essayIndex = essayIndex;

        essayContainer.querySelectorAll('.editable-score').forEach(input => {
            // Store essay index on each input for easy access
            input.dataset.essayIndex = essayIndex;

            // Only add listener if not already added
            if (!input.dataset.listenerAdded) {
                input.dataset.listenerAdded = 'true';

                input.addEventListener('input', function() {
                    // Get the essay index from the input's data attribute
                    const currentEssayIndex = parseInt(this.dataset.essayIndex);
                    const category = this.dataset.category;
                    const newPoints = parseFloat(this.value) || 0;
                    const maxPoints = parseFloat(this.max) || 15;

                    console.log('📝 Batch essay score changed:', { essayIndex: currentEssayIndex, category, newPoints });

                    // Validate range
                    if (newPoints < 0) this.value = 0;
                    if (newPoints > maxPoints) this.value = maxPoints;

                    // Update data for this specific essay
                    if (batchGradingData[currentEssayIndex] &&
                        batchGradingData[currentEssayIndex].gradingData.scores &&
                        batchGradingData[currentEssayIndex].gradingData.scores[category]) {
                        batchGradingData[currentEssayIndex].gradingData.scores[category].points = parseFloat(this.value);
                    }

                    // Recalculate total score for this specific essay
                    updateTotalScore(currentEssayIndex);
                });
            }
        });

        // Add listeners for arrow click areas within this essay container
        essayContainer.querySelectorAll('.arrow-up-area:not([data-listener-added]), .arrow-down-area:not([data-listener-added])').forEach(arrow => {
            arrow.dataset.listenerAdded = 'true';
            arrow.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent event bubbling
                e.preventDefault(); // Prevent default behavior

                const input = this.parentElement.querySelector('.editable-score');
                if (input) {
                    // Store current value
                    const currentValue = parseFloat(input.value) || 0;
                    const max = parseFloat(input.max) || 15;
                    const min = parseFloat(input.min) || 0;

                    // Calculate new value (increment by 1)
                    let newValue;
                    if (this.classList.contains('arrow-up-area')) {
                        newValue = Math.min(currentValue + 1, max);
                    } else if (this.classList.contains('arrow-down-area')) {
                        newValue = Math.max(currentValue - 1, min);
                    }

                    // Set the new value and let the input event handler take care of the rest
                    if (newValue !== currentValue) {
                        input.value = newValue;

                        // Trigger input event to let existing listeners handle the update
                        input.dispatchEvent(new Event('input'));

                        console.log(`⬆️⬇️ Arrow clicked for essay ${essayIndex}, new value:`, newValue);
                    }
                }
            });
        });
    }

    // Add listeners for feedback textareas within the specific essay container
    if (essayContainer) {
        essayContainer.querySelectorAll('.editable-feedback').forEach(textarea => {
            textarea.addEventListener('input', function() {
                const category = this.dataset.category;
                // Update data for this specific essay
                if (batchGradingData[essayIndex] &&
                    batchGradingData[essayIndex].gradingData.scores &&
                    batchGradingData[essayIndex].gradingData.scores[category]) {
                    batchGradingData[essayIndex].gradingData.scores[category].rationale = this.value;
                }
            });

            // Auto-resize textarea
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = this.scrollHeight + 'px';
            });
        });
    }

    // Setup editing functions integration
    if (window.EditingFunctionsModule) {
        window.EditingFunctionsModule.setupEditableElements();
    }

    // Setup category note toggle listeners (for auto-filled rationales)
    // Use setTimeout to ensure DOM is fully ready
    setTimeout(() => {
        if (window.setupCategoryNoteToggleListeners) {
            window.setupCategoryNoteToggleListeners();
        }
    }, 50);
}

/**
 * Update total score display
 * @param {number} essayIndex - Optional essay index for batch processing
 */
function updateTotalScore(essayIndex = null) {
    let gradingData;

    console.log('🔄 updateTotalScore called with essayIndex:', essayIndex);

    // Determine which data to use based on whether this is batch or single
    if (essayIndex !== null && batchGradingData[essayIndex]) {
        gradingData = batchGradingData[essayIndex].gradingData;
        console.log('📊 Using batch grading data for essay', essayIndex);
    } else {
        gradingData = currentGradingData;
        console.log('📊 Using single grading data');
    }

    if (!gradingData || !gradingData.scores) {
        console.warn('⚠️ No grading data available');
        return;
    }

    let totalPoints = 0;
    let totalMaxPoints = 0;

    Object.values(gradingData.scores).forEach(score => {
        totalPoints += score.points || 0;
        totalMaxPoints += score.out_of || 0;
    });

    console.log('📈 Calculated totals:', { totalPoints, totalMaxPoints });

    // Update stored data
    if (gradingData.total) {
        gradingData.total.points = totalPoints;
        gradingData.total.out_of = totalMaxPoints;
    }

    // Update the displayed total score
    let overallScoreElement;
    if (essayIndex !== null) {
        // For batch processing, find the overall score within the specific essay container
        const essayContainer = document.getElementById(`batch-essay-${essayIndex}`);
        overallScoreElement = essayContainer ? essayContainer.querySelector('.overall-score') : null;
    } else {
        // For single essays, use the global selector
        overallScoreElement = document.querySelector('.overall-score');
    }

    if (overallScoreElement) {
        // Use the same simple format as the initial display to maintain consistency
        overallScoreElement.innerHTML = `${totalPoints}/${totalMaxPoints}`;
    }

    // Update individual category displays if needed
    updateCategoryPercentages(essayIndex);
}

/**
 * Update category percentage displays
 * @param {number} essayIndex - Optional essay index for batch processing
 */
function updateCategoryPercentages(essayIndex = null) {
    // Determine which data to use
    let gradingData;
    if (essayIndex !== null && batchGradingData[essayIndex]) {
        gradingData = batchGradingData[essayIndex].gradingData;
    } else {
        gradingData = currentGradingData;
    }

    if (!gradingData || !gradingData.scores) return;

    // Update percentages for the appropriate container
    let container = document;
    if (essayIndex !== null) {
        container = document.getElementById(`batch-essay-${essayIndex}`) || document;
    }

    container.querySelectorAll('.editable-score').forEach(input => {
        const category = input.dataset.category;
        const score = gradingData.scores[category];

        if (score) {
            const percentage = Math.round((score.points / score.out_of) * 100);
            const percentageElement = input.parentElement.querySelector('.category-percentage');

            if (percentageElement) {
                percentageElement.textContent = `(${percentage}%)`;
            }
        }
    });
}

/**
 * Update batch essay score
 * @param {number} essayIndex - Essay index
 * @param {string} category - Category to update
 * @param {number} points - New points value
 * @param {number} maxPoints - Maximum points
 */
function updateBatchScore(essayIndex, category, points, maxPoints) {
    if (!batchGradingData[essayIndex]) {
        console.warn(`No batch grading data for essay ${essayIndex}`);
        return;
    }

    const data = batchGradingData[essayIndex].gradingData;
    if (data && data.scores && data.scores[category]) {
        data.scores[category].points = points;
        data.scores[category].out_of = maxPoints;

        // Trigger total score update
        updateTotalScore(essayIndex);
    }
}

/**
 * Get current grading data
 * @returns {Object} Current grading data
 */
function getCurrentGradingData() {
    return currentGradingData;
}

/**
 * Get current original data
 * @returns {Object} Current original data
 */
function getCurrentOriginalData() {
    return currentOriginalData;
}

/**
 * Save current grading state to localStorage
 */
function saveGradingState() {
    if (currentGradingData && currentOriginalData) {
        const state = {
            gradingData: currentGradingData,
            originalData: currentOriginalData,
            timestamp: Date.now()
        };
        localStorage.setItem('currentGradingState', JSON.stringify(state));
    }
}

/**
 * Restore grading state from localStorage
 * @returns {Object|null} Restored state or null
 */
function restoreGradingState() {
    try {
        const saved = localStorage.getItem('currentGradingState');
        if (saved) {
            const state = JSON.parse(saved);
            // Check if state is not too old (1 hour)
            if (Date.now() - state.timestamp < 3600000) {
                currentGradingData = state.gradingData;
                currentOriginalData = state.originalData;
                return state;
            }
        }
    } catch (error) {
        console.error('Error restoring grading state:', error);
    }
    return null;
}

/**
 * Clear saved grading state
 */
function clearGradingState() {
    localStorage.removeItem('currentGradingState');
    currentGradingData = null;
    currentOriginalData = null;
}

/**
 * Export current grading data
 * @returns {Object} Exportable grading data
 */
function exportGradingData() {
    return {
        gradingData: currentGradingData,
        originalData: currentOriginalData,
        highlights: window.HighlightingModule ?
            window.HighlightingModule.exportHighlightsData() : [],
        timestamp: Date.now()
    };
}

/**
 * Import grading data
 * @param {Object} data - Grading data to import
 */
function importGradingData(data) {
    if (data.gradingData && data.originalData) {
        displayResults(data.gradingData, data.originalData);

        // Import highlights if available
        if (data.highlights && window.HighlightingModule) {
            setTimeout(() => {
                window.HighlightingModule.importHighlightsData(data.highlights);
            }, 500);
        }
    }
}

/**
 * Validate grading data integrity
 * @param {Object} gradingData - Grading data to validate
 * @returns {boolean} True if valid
 */
function validateGradingData(gradingData) {
    if (!gradingData || typeof gradingData !== 'object') return false;

    // Check for required properties
    if (!gradingData.scores || typeof gradingData.scores !== 'object') return false;

    // Validate scores structure
    for (const [category, score] of Object.entries(gradingData.scores)) {
        if (!score || typeof score.points !== 'number' || typeof score.out_of !== 'number') {
            return false;
        }
        if (score.points < 0 || score.points > score.out_of) {
            return false;
        }
    }

    return true;
}

/**
 * Fallback implementation for createSingleEssayHTML
 */
function createSingleEssayHTMLFallback(studentName, formatted) {
    return `
        <h2>Grading Results for ${studentName}</h2>
        ${formatted.feedbackSummary || ''}
        <h3>Essay Text:</h3>
        <div class="formatted-essay-content">
            ${formatted.formattedText || ''}
        </div>
    `;
}

// Export functions for module usage
window.SingleResultModule = {
    displayResults,
    setupEditableElements,
    setupBatchEditableElements,
    updateTotalScore,
    updateCategoryPercentages,
    updateBatchScore,
    getCurrentGradingData,
    getCurrentOriginalData,
    saveGradingState,
    restoreGradingState,
    clearGradingState,
    exportGradingData,
    importGradingData,
    validateGradingData,
    // Expose batch data for debugging
    getBatchGradingData: () => batchGradingData
};