/**
 * Single Result Module
 * Handles display and management of single essay grading results
 */

// Global state for current grading data
let currentGradingData = null;
let currentOriginalData = null;

/**
 * Display results for a single essay
 * @param {Object} gradingResult - The grading result from the server
 * @param {Object} originalData - The original form data
 */
function displayResults(gradingResult, originalData) {
    console.log('🎯 DISPLAY RESULTS CALLED');
    console.log('Grading result:', gradingResult);
    console.log('Original data:', originalData);

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

    // Add listeners for score inputs
    document.querySelectorAll('.editable-score').forEach(input => {
        input.addEventListener('input', function() {
            const category = this.dataset.category;
            const newPoints = parseFloat(this.value) || 0;
            const maxPoints = parseFloat(this.max) || 15;

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

    // Setup editing functions integration
    if (window.EditingFunctionsModule) {
        window.EditingFunctionsModule.setupEditableElements();
    }
}

/**
 * Setup editable elements for batch essay results
 * @param {Object} gradingResult - Grading result object
 * @param {Object} originalData - Original form data
 * @param {number} essayIndex - Essay index for batch processing
 */
function setupBatchEditableElements(gradingResult, originalData, essayIndex) {
    currentGradingData = { ...gradingResult };
    currentOriginalData = { ...originalData };

    // Add listeners for score inputs within the specific essay container
    const essayContainer = document.getElementById(`batch-essay-${essayIndex}`);
    if (essayContainer) {
        essayContainer.querySelectorAll('.editable-score').forEach(input => {
            input.addEventListener('input', function() {
                const category = this.dataset.category;
                const newPoints = parseFloat(this.value) || 0;
                const maxPoints = parseFloat(this.max) || 15;

                // Validate range
                if (newPoints < 0) this.value = 0;
                if (newPoints > maxPoints) this.value = maxPoints;

                // Update data
                if (currentGradingData.scores && currentGradingData.scores[category]) {
                    currentGradingData.scores[category].points = parseFloat(this.value);
                }

                // Recalculate total score for this specific essay
                updateTotalScore(essayIndex);
            });
        });
    }

    // Add listeners for feedback textareas within the specific essay container
    if (essayContainer) {
        essayContainer.querySelectorAll('.editable-feedback').forEach(textarea => {
            textarea.addEventListener('input', function() {
                const category = this.dataset.category;
                if (currentGradingData.scores && currentGradingData.scores[category]) {
                    currentGradingData.scores[category].rationale = this.value;
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
}

/**
 * Update total score display
 * @param {number} essayIndex - Optional essay index for batch processing
 */
function updateTotalScore(essayIndex = null) {
    if (!currentGradingData || !currentGradingData.scores) return;

    let totalPoints = 0;
    let totalMaxPoints = 0;

    Object.values(currentGradingData.scores).forEach(score => {
        totalPoints += score.points;
        totalMaxPoints += score.out_of;
    });

    // Update stored data
    if (currentGradingData.total) {
        currentGradingData.total.points = totalPoints;
        currentGradingData.total.out_of = totalMaxPoints;
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
    updateCategoryPercentages();
}

/**
 * Update category percentage displays
 */
function updateCategoryPercentages() {
    document.querySelectorAll('.editable-score').forEach(input => {
        const category = input.dataset.category;
        const score = currentGradingData.scores[category];

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
    getCurrentGradingData,
    getCurrentOriginalData,
    saveGradingState,
    restoreGradingState,
    clearGradingState,
    exportGradingData,
    importGradingData,
    validateGradingData
};