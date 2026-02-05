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
 * @param {number} essayIndex - Optional essay index for batch processing
 */
function updateTotalScore(essayIndex = null) {
    if (window.SingleResultModule) {
        window.SingleResultModule.updateTotalScore(essayIndex);
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
 * Toggle tab (Grade Details or Highlights)
 * @param {string} tabId - ID of the tab to toggle
 * @param {number} index - Student index
 */
function toggleTab(tabId, index) {
    const tab = document.getElementById(tabId);
    const arrow = document.getElementById(`${tabId}-arrow`);

    if (!tab) {
        console.error('❌ Tab element not found:', tabId);
        return;
    }

    // Determine which tab this is
    const isGradeDetails = tabId.includes('grade-details');
    const isHighlightsTab = tabId.includes('highlights-tab');

    // Check if currently closed
    const isCurrentlyClosed = tab.style.maxHeight === '0px' || tab.style.maxHeight === '' || tab.style.maxHeight === '0';

    if (isCurrentlyClosed) {
        // Load content first
        if (isGradeDetails) {
            loadEssayDetails(index);
        } else if (isHighlightsTab) {
            loadHighlightsTab(index);
        }

        // Use a large fixed height to accommodate content
        // This avoids the scrollHeight=0 issue with overflow:hidden
        tab.style.maxHeight = '10000px';

        if (arrow) {
            arrow.style.transform = 'rotate(180deg)';
        }

        // Adjust height after content loads to fit perfectly
        setTimeout(() => {
            // Force a reflow to get accurate scrollHeight
            tab.style.display = 'block';
            const adjustedHeight = Math.max(tab.scrollHeight + 100, 2000) + 'px';
            tab.style.maxHeight = adjustedHeight;
        }, 350);
    } else {
        // Close this tab
        tab.style.maxHeight = '0px';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
}

/**
 * Load highlights tab content
 * @param {number} index - Essay index
 */
function loadHighlightsTab(index) {
    const contentDiv = document.getElementById(`highlights-tab-content-${index}`);
    if (!contentDiv) return;

    // Check if already loaded
    if (contentDiv.dataset.loaded === 'true') return;

    // Get essay container to extract highlights
    const essayContainer = document.querySelector(`.formatted-essay-content[data-essay-index="${index}"]`);
    if (!essayContainer) {
        // Essay details not loaded yet - load them first, then populate highlights
        console.log(`📄 Essay content not loaded for index ${index}, loading now...`);

        // Check if essay data exists
        if (!window[`essayData_${index}`]) {
            contentDiv.innerHTML = '<p style="color: #999;">Essay data not available.</p>';
            return;
        }

        // Show loading message
        contentDiv.innerHTML = '<p style="color: #666;">Loading essay content...</p>';

        // Load essay details first - call directly since it's exported
        if (typeof loadEssayDetails === 'function') {
            loadEssayDetails(index);
        } else if (window.BatchProcessingModule && window.BatchProcessingModule.loadEssayDetails) {
            window.BatchProcessingModule.loadEssayDetails(index);
        } else {
            contentDiv.innerHTML = '<p style="color: #999;">Unable to load essay content.</p>';
            return;
        }

        // Poll for essay to be loaded (more reliable than single setTimeout)
        let attempts = 0;
        const maxAttempts = 20; // 20 attempts * 100ms = 2 seconds max wait
        const checkInterval = setInterval(() => {
            attempts++;
            const essayContainerRetry = document.querySelector(`.formatted-essay-content[data-essay-index="${index}"]`);

            if (essayContainerRetry) {
                clearInterval(checkInterval);
                console.log(`✅ Essay loaded after ${attempts * 100}ms, now populating highlights for index ${index}`);
                // Reset loaded flag so we can populate now
                contentDiv.dataset.loaded = 'false';
                // Recursively call to populate highlights now that essay is loaded
                loadHighlightsTab(index);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.error(`❌ Essay failed to load after ${maxAttempts * 100}ms`);
                contentDiv.innerHTML = '<p style="color: #999;">Error loading essay content. Please try refreshing.</p>';
            }
        }, 100); // Check every 100ms

        return;
    }

    // Extract highlights directly - use broader selector to find ALL highlights
    const highlights = essayContainer.querySelectorAll('mark[data-category], mark[data-type], span[data-category], span[data-type]');

    if (highlights.length === 0) {
        contentDiv.innerHTML = '<p style="color: #999;">No highlights found in the essay.</p>';
        contentDiv.dataset.loaded = 'true';
        return;
    }

    // Build highlights data
    const highlightsData = [];
    let highlightNumber = 1;

    highlights.forEach((mark, markIndex) => {
        try {
            // Ensure highlight has an ID
            if (!mark.id || mark.id.trim() === '') {
                mark.id = `highlight-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            }

            const categories = (mark.dataset.category || mark.dataset.type || 'highlight').split(',').map(c => c.trim());
            const correction = mark.dataset.correction || mark.dataset.message || '';
            const explanation = mark.dataset.explanation || '';
            const notes = mark.dataset.notes || mark.title || '';
            const originalText = mark.dataset.originalText || mark.textContent || '';

            // Validate we have text
            if (!originalText || originalText.trim() === '') {
                return;
            }

            highlightsData.push({
                number: highlightNumber,
                text: originalText.trim(),
                categories: categories,
                correction: correction.trim(),
                explanation: explanation.trim(),
                notes: notes.trim(),
                elementId: mark.id,
                isExcluded: mark.dataset.excludeFromPdf === 'true'
            });

            highlightNumber++;
        } catch (error) {
            console.error(`Error processing highlight ${markIndex + 1}:`, error);
        }
    });

    // Generate HTML directly without nested wrapper
    if (highlightsData.length === 0) {
        contentDiv.innerHTML = '<p style="color: #999;">No highlights with text found.</p>';
    } else {
        // Use the existing createHighlightsLegendHTML function from DisplayUtilsModule
        // (it includes the intro text)
        let html = '';
        if (window.DisplayUtilsModule && window.DisplayUtilsModule.createHighlightsLegendHTML) {
            html = window.DisplayUtilsModule.createHighlightsLegendHTML(highlightsData);
        }

        contentDiv.innerHTML = html;

        // Setup toggle PDF button listeners
        if (window.DisplayUtilsModule && window.DisplayUtilsModule.setupTogglePDFListeners) {
            window.DisplayUtilsModule.setupTogglePDFListeners(contentDiv);
        }

        // Setup remove-all checkbox listener
        const checkbox = document.getElementById(`highlights-tab-${index}-remove-all`);
        if (checkbox) {
            setupRemoveAllCheckboxForTab(checkbox, contentDiv);
        }
    }

    contentDiv.dataset.loaded = 'true';
}

/**
 * Setup remove-all checkbox for a highlights tab
 * @param {HTMLElement} checkbox - The checkbox element
 * @param {HTMLElement} contentDiv - The content container
 */
function setupRemoveAllCheckboxForTab(checkbox, contentDiv) {
    // Prevent duplicate setups
    if (checkbox.dataset.setupComplete === 'true') {
        console.log(`⚠️ Checkbox already set up, skipping`);
        return;
    }

    console.log('🔧 Setting up remove-all checkbox for tab');
    console.log(`📋 Checkbox state at setup time: ${checkbox.checked}`);

    // Get the contentId from the checkbox's data attribute or ID
    const contentId = checkbox.dataset.contentId || checkbox.id.replace('-remove-all', '');

    // CAPTURE the checkbox state IMMEDIATELY before any other operations
    const currentCheckboxState = checkbox.checked;
    const savedState = localStorage.getItem(`removeAllFromPDF_${contentId}`);

    console.log(`💾 Saved localStorage state: ${savedState}`);
    console.log(`✋ Current DOM checkbox state: ${currentCheckboxState}`);

    let isChecked;

    // Priority order:
    // 1. Use saved localStorage state if it exists (most reliable)
    // 2. If no saved state but checkbox is checked, respect that (user interacted before content loaded)
    // 3. Otherwise, default to unchecked
    if (savedState !== null) {
        // Restore from localStorage - this is the most reliable source
        isChecked = savedState === 'true';
        checkbox.checked = isChecked;
        console.log(`📥 Restored checkbox state from localStorage: ${isChecked}`);
    } else if (currentCheckboxState) {
        // User manually checked before content loaded - save this to localStorage
        isChecked = true;
        localStorage.setItem(`removeAllFromPDF_${contentId}`, 'true');
        console.log('✅ User pre-checked checkbox detected (no saved state), saving to localStorage');
    } else {
        // Default to unchecked
        isChecked = false;
        checkbox.checked = false;
        console.log('📊 No saved state or pre-check, defaulting to unchecked');
    }

    // Apply the determined state to all highlights immediately
    if (isChecked) {
        const toggleButtons = contentDiv.querySelectorAll('.toggle-pdf-btn');
        console.log(`🔍 Applying checked state to ${toggleButtons.length} toggle buttons`);

        toggleButtons.forEach(button => {
            const elementId = button.dataset.elementId;
            const highlightElement = document.getElementById(elementId);

            if (highlightElement) {
                highlightElement.dataset.excludeFromPdf = 'true';
                button.dataset.excluded = 'true';
                button.style.background = '#28a745';
                button.textContent = '+';
                button.onmouseover = function() { this.style.background = '#218838'; };
                button.onmouseout = function() { this.style.background = '#28a745'; };

                const entryDiv = button.closest('div[style*="margin: 20px 0"]');
                if (entryDiv) {
                    entryDiv.style.textDecoration = 'line-through';
                    entryDiv.style.opacity = '0.6';
                }
            }
        });
    }

    // Add change listener
    checkbox.addEventListener('change', function() {
        const isChecked = this.checked;
        console.log(`📋 Remove-all checkbox ${isChecked ? 'CHECKED' : 'UNCHECKED'}`);

        // Save state to localStorage
        localStorage.setItem(`removeAllFromPDF_${contentId}`, isChecked.toString());
        console.log(`💾 Saved checkbox state to localStorage: ${isChecked}`);

        const toggleButtons = contentDiv.querySelectorAll('.toggle-pdf-btn');

        toggleButtons.forEach(button => {
            const elementId = button.dataset.elementId;
            const highlightElement = document.getElementById(elementId);

            if (!highlightElement) return;

            // Set excluded state
            highlightElement.dataset.excludeFromPdf = isChecked ? 'true' : 'false';
            button.dataset.excluded = isChecked;

            // Update button appearance
            if (isChecked) {
                button.style.background = '#28a745';
                button.textContent = '+';
                button.onmouseover = function() { this.style.background = '#218838'; };
                button.onmouseout = function() { this.style.background = '#28a745'; };
            } else {
                button.style.background = '#dc3545';
                button.textContent = '-';
                button.onmouseover = function() { this.style.background = '#c82333'; };
                button.onmouseout = function() { this.style.background = '#dc3545'; };
            }

            // Update entry styling
            const entryDiv = button.closest('div[style*="margin: 20px 0"]');
            if (entryDiv) {
                if (isChecked) {
                    entryDiv.style.textDecoration = 'line-through';
                    entryDiv.style.opacity = '0.6';
                } else {
                    entryDiv.style.textDecoration = 'none';
                    entryDiv.style.opacity = '1';
                }
            }
        });
    });

    // Mark checkbox as set up to prevent duplicate setups
    checkbox.dataset.setupComplete = 'true';
    console.log(`✅ Checkbox setup complete`);
}

/**
 * Refresh a specific highlights tab
 * @param {number} index - Essay index
 */
function refreshHighlightsTab(index) {
    const contentDiv = document.getElementById(`highlights-tab-content-${index}`);
    const tab = document.getElementById(`highlights-tab-${index}`);

    if (!contentDiv) {
        console.log(`refreshHighlightsTab: contentDiv not found for index ${index}`);
        return;
    }

    // Check if the tab is currently expanded
    const isExpanded = tab && (tab.style.maxHeight !== '0px' && tab.style.maxHeight !== '');

    console.log(`refreshHighlightsTab: index ${index}, isExpanded: ${isExpanded}`);

    // Reset the loaded flag to force reload
    contentDiv.dataset.loaded = 'false';

    if (isExpanded) {
        console.log(`Refreshing expanded highlights tab: ${index}`);
        // Reload the content
        loadHighlightsTab(index);

        // Re-adjust tab height after content changes
        setTimeout(() => {
            if (tab) {
                tab.style.maxHeight = Math.max(tab.scrollHeight + 100, 2000) + 'px';
            }
        }, 100);
    } else {
        console.log(`Tab ${index} is collapsed, will refresh when opened`);
    }
}

/**
 * Setup event listeners for highlight changes
 */
function setupHighlightChangeListeners() {
    if (!window.eventBus) {
        console.warn('EventBus not available for highlight change listeners');
        return;
    }

    console.log('Setting up highlight change listeners for tabs');

    // Listen for highlight updates (when user saves edits)
    window.eventBus.on('highlight:updated', (data) => {
        console.log('Received highlight:updated event', data);

        // Refresh all highlights tabs (check for multiple essays)
        for (let i = 0; i < 50; i++) {
            const contentDiv = document.getElementById(`highlights-tab-content-${i}`);
            if (contentDiv) {
                refreshHighlightsTab(i);
            }
        }
    });

    // Listen for highlight removals
    window.eventBus.on('highlight:removed', (data) => {
        console.log('Received highlight:removed event', data);

        // Refresh all highlights tabs
        for (let i = 0; i < 50; i++) {
            const contentDiv = document.getElementById(`highlights-tab-content-${i}`);
            if (contentDiv) {
                refreshHighlightsTab(i);
            }
        }
    });

    console.log('Highlight change listeners registered for tabs');
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
            <h2>Grading Results</h2>
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
window.toggleTab = toggleTab;
window.loadHighlightsTab = loadHighlightsTab;
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
    toggleTab,
    loadHighlightsTab,
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
    getGradingDisplayStatus,
    refreshHighlightsTab,
    setupHighlightChangeListeners
};

// Setup event listeners when module loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHighlightChangeListeners);
} else {
    setupHighlightChangeListeners();
}