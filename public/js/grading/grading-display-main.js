/**
 * Grading Display Main Module
 * Main controller for grading display functionality, integrates all grading display modules
 */

/**
 * Display results for a single essay
 * @param {Object} gradingResult - The grading result from the server
 * @param {Object} originalData - The original form data
 */
function displayResults(gradingResult, originalData) {
    if (window.SingleResultModule) {
        window.SingleResultModule.displayResults(gradingResult, originalData);
    } else {
        console.error('SingleResultModule not available');
    }
}

/**
 * Display batch grading results
 * @param {Object} batchResult - The batch grading result
 * @param {Object} originalData - The original form data
 */
function displayBatchResults(batchResult, originalData) {
    if (window.BatchProcessingModule) {
        window.BatchProcessingModule.displayBatchResults(batchResult, originalData);
    } else {
        console.error('BatchProcessingModule not available');
    }
}

/**
 * Setup editable elements for grading results
 * @param {Object} gradingResult - Grading result object
 * @param {Object} originalData - Original form data
 */
function setupEditableElements(gradingResult, originalData) {
    if (window.SingleResultModule) {
        window.SingleResultModule.setupEditableElements(gradingResult, originalData);
    }
}

/**
 * Update total score display
 */
function updateTotalScore() {
    if (window.SingleResultModule) {
        window.SingleResultModule.updateTotalScore();
    }
}

/**
 * Toggle student details in batch results
 * @param {number} index - Student index
 */
function toggleStudentDetails(index) {
    if (window.BatchProcessingModule) {
        window.BatchProcessingModule.toggleStudentDetails(index);
    }
}

/**
 * Load essay details for batch result expansion
 * @param {number} index - Essay index
 */
function loadEssayDetails(index) {
    if (window.BatchProcessingModule) {
        window.BatchProcessingModule.loadEssayDetails(index);
    }
}

/**
 * Download individual essay
 * @param {number} index - Essay index
 */
function downloadIndividualEssay(index) {
    if (window.BatchProcessingModule) {
        window.BatchProcessingModule.downloadIndividualEssay(index);
    }
}

/**
 * Download all essays
 */
function downloadAllEssays() {
    if (window.BatchProcessingModule) {
        window.BatchProcessingModule.downloadAllEssays();
    }
}

/**
 * Get current grading data
 * @returns {Object} Current grading data
 */
function getCurrentGradingData() {
    if (window.SingleResultModule) {
        return window.SingleResultModule.getCurrentGradingData();
    }
    return null;
}

/**
 * Get current original data
 * @returns {Object} Current original data
 */
function getCurrentOriginalData() {
    if (window.SingleResultModule) {
        return window.SingleResultModule.getCurrentOriginalData();
    }
    return null;
}

/**
 * Create HTML for single essay display
 * @param {string} studentName - Student name
 * @param {Object} formatted - Formatted essay data
 * @returns {string} HTML string
 */
function createSingleEssayHTML(studentName, formatted) {
    if (window.DisplayUtilsModule) {
        return window.DisplayUtilsModule.createSingleEssayHTML(studentName, formatted);
    }

    // Fallback implementation
    return `
        <h2>Grading Results for ${studentName}</h2>
        ${formatted.feedbackSummary || ''}
        <div class="formatted-essay-content">
            ${formatted.formattedText || ''}
        </div>
    `;
}

/**
 * Create HTML for batch essay display
 * @param {Object} formatted - Formatted essay data
 * @param {number} index - Essay index
 * @returns {string} HTML string
 */
function createBatchEssayHTML(formatted, index) {
    if (window.DisplayUtilsModule) {
        return window.DisplayUtilsModule.createBatchEssayHTML(formatted, index);
    }

    // Fallback implementation
    return `
        ${formatted.feedbackSummary || ''}
        <div class="formatted-essay-content" data-essay-index="${index}">
            ${formatted.formattedText || ''}
        </div>
    `;
}

/**
 * Create HTML for student row in batch results
 * @param {Object} essay - Essay result object
 * @param {number} index - Essay index
 * @param {string} statusIcon - HTML for status icon
 * @returns {string} HTML string
 */
function createStudentRowHTML(essay, index, statusIcon) {
    if (window.DisplayUtilsModule) {
        return window.DisplayUtilsModule.createStudentRowHTML(essay, index, statusIcon);
    }

    // Fallback implementation
    return `
        <div class="student-row">
            <div onclick="toggleStudentDetails(${index})">
                ${statusIcon} ${essay.studentName}
            </div>
            <div id="student-details-${index}" style="display: none;">
                ${essay.success ? 'Loading...' : `Error: ${essay.error}`}
            </div>
        </div>
    `;
}

/**
 * Create HTML for batch results display
 * @param {Object} batchResult - Batch grading results
 * @param {number} successCount - Number of successful gradings
 * @param {number} failureCount - Number of failed gradings
 * @returns {string} HTML string
 */
function createBatchResultsHTML(batchResult, successCount, failureCount) {
    if (window.DisplayUtilsModule) {
        return window.DisplayUtilsModule.createBatchResultsHTML(batchResult, successCount, failureCount);
    }

    // Fallback implementation
    return `
        <div class="batch-results">
            <h2>Batch Grading Results</h2>
            <p>Success: ${successCount}, Failed: ${failureCount}</p>
        </div>
    `;
}

/**
 * Show loading state
 * @param {string} message - Loading message
 */
function showLoading(message = 'Loading...') {
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        const loadingHTML = window.DisplayUtilsModule ?
            window.DisplayUtilsModule.createLoadingSpinner(message) :
            `<div class="loading">${message}</div>`;
        resultsDiv.innerHTML = loadingHTML;
        resultsDiv.style.display = 'block';
    }
}

/**
 * Show error state
 * @param {string} message - Error message
 * @param {string} details - Error details
 */
function showError(message, details = '') {
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        const errorHTML = window.DisplayUtilsModule ?
            window.DisplayUtilsModule.createErrorHTML(message, details) :
            `<div class="error">${message}</div>`;
        resultsDiv.innerHTML = errorHTML;
        resultsDiv.style.display = 'block';
    }
}

/**
 * Clear results display
 */
function clearResults() {
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        resultsDiv.innerHTML = '';
        resultsDiv.style.display = 'none';
    }
}

/**
 * Initialize grading display system
 */
function initializeGradingDisplay() {
    console.log('🔧 Initializing grading display system...');

    // Setup batch processing if available
    if (window.BatchProcessingModule) {
        window.BatchProcessingModule.setupBatchProcessing();
    }

    // Restore any saved state
    if (window.SingleResultModule) {
        const savedState = window.SingleResultModule.restoreGradingState();
        if (savedState) {
            console.log('📝 Restored saved grading state');
        }
    }

    console.log('✅ Grading display system initialized');
}

/**
 * Cleanup grading display
 */
function cleanupGradingDisplay() {
    // Save current state
    if (window.SingleResultModule) {
        window.SingleResultModule.saveGradingState();
    }

    // Clear displays
    clearResults();
}

/**
 * Get grading display status
 * @returns {Object} Status information
 */
function getGradingDisplayStatus() {
    const hasCurrentData = !!(getCurrentGradingData() && getCurrentOriginalData());
    const batchStatus = window.BatchProcessingModule ?
        window.BatchProcessingModule.getBatchCompletionStatus() : null;

    return {
        hasSingleResult: hasCurrentData,
        batchStatus: batchStatus,
        modulesLoaded: {
            singleResult: !!window.SingleResultModule,
            batchProcessing: !!window.BatchProcessingModule,
            displayUtils: !!window.DisplayUtilsModule
        }
    };
}

// Backward compatibility: expose functions globally for existing code
window.displayResults = displayResults;
window.displayBatchResults = displayBatchResults;
window.setupEditableElements = setupEditableElements;
window.updateTotalScore = updateTotalScore;
window.toggleStudentDetails = toggleStudentDetails;
window.loadEssayDetails = loadEssayDetails;
window.downloadIndividualEssay = downloadIndividualEssay;
window.downloadAllEssays = downloadAllEssays;
window.getCurrentGradingData = getCurrentGradingData;
window.getCurrentOriginalData = getCurrentOriginalData;
window.createSingleEssayHTML = createSingleEssayHTML;

// Export main module
window.GradingDisplayModule = {
    displayResults,
    displayBatchResults,
    setupEditableElements,
    updateTotalScore,
    toggleStudentDetails,
    loadEssayDetails,
    downloadIndividualEssay,
    downloadAllEssays,
    getCurrentGradingData,
    getCurrentOriginalData,
    createSingleEssayHTML,
    createBatchEssayHTML,
    createStudentRowHTML,
    createBatchResultsHTML,
    showLoading,
    showError,
    clearResults,
    initializeGradingDisplay,
    cleanupGradingDisplay,
    getGradingDisplayStatus
};