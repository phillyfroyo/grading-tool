/**
 * Batch Processing Module
 * Handles batch grading display and management functionality
 */

// Track processing status for queue management
let processingQueue = {
    currentlyProcessing: 0,
    maxConcurrent: 2,
    totalEssays: 0,
    completedEssays: [],
    nextInQueue: 2
};

/**
 * Get a random Claude-style loading message
 */
function getClaudeLoadingMessage() {
    const messages = [
        "🤔 Cogitating on this essay...",
        "✨ Percolating thoughts...",
        "🔮 Ruminating deeply...",
        "💭 Mulling this over...",
        "🌀 Churning through ideas...",
        "🎯 Calibrating analysis...",
        "📚 Parsing pedagogical patterns...",
        "🧠 Neurons firing...",
        "⚡ Synapses sparking...",
        "🔍 Scrutinizing semantics...",
        "💡 Illuminating insights...",
        "🎨 Crafting comprehension...",
        "🌟 Crystallizing conclusions...",
        "📖 Decoding discourse...",
        "🎭 Contemplating composition...",
        "🔬 Analyzing argumentation...",
        "🌈 Synthesizing structures...",
        "🎪 Juggling judgments...",
        "🎢 Navigating nuances...",
        "🎪 Orchestrating observations...",
        "💪 Working hard...",
        "🧠 Thinking vigorously...",
        "🤗 I'm trying my best..."
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Display initial batch grading progress UI
 * @param {Object} batchData - The batch data being processed
 */
function displayBatchProgress(batchData) {
    console.log('🎯 DISPLAY BATCH PROGRESS UI CALLED');
    console.log('📊 Batch data:', batchData);

    // Initialize queue tracking
    processingQueue = {
        currentlyProcessing: Math.min(2, batchData.essays.length),
        maxConcurrent: 2,
        totalEssays: batchData.essays.length,
        completedEssays: [],
        nextInQueue: 2
    };

    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;

    // Create the progress UI immediately
    const progressHtml = `
        <div class="batch-results">
            <h2>Grading ${batchData.essays.length} Essays. This will take a few minutes.</h2>
            <div style="background: #fff3cd; border: 2px solid #ffc107; padding: 20px; border-radius: 8px; margin: 20px 0; color: #856404; font-size: 18px; line-height: 1.5; font-weight: 500;">
                <strong style="font-size: 20px;">⚠️ Important:</strong> The AI will make mistakes. Please review all essays and make any necessary manual edits.
            </div>
            <div class="compact-student-list" style="margin: 20px 0;">
                ${batchData.essays.map((essay, index) => `
                    <div class="student-row" id="student-row-${index}" style="border: 2px solid #ddd; margin: 16px 0; border-radius: 8px; overflow: hidden;">
                        <div class="student-header" onclick="toggleStudentDetails(${index})" style="
                            padding: 24px 30px;
                            background: #fff;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            transition: background-color 0.2s;
                            font-size: 22px;
                            font-weight: 500;
                            min-height: 60px;
                        " onmouseover="this.style.backgroundColor='#f8f9fa'"
                           onmouseout="this.style.backgroundColor='#fff'">
                            <div style="display: flex; align-items: center; gap: 15px; flex: 1; min-width: 0;">
                                <div id="student-status-${index}" class="student-status" style="display: flex; align-items: center; gap: 12px;">
                                    ${index < 2 ?
                                        `<div class="loading-spinner" id="spinner-${index}" style="width: 24px; height: 24px; border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                                        <span id="processing-message-${index}" style="color: #666; font-size: 18px; font-weight: 500;">Processing...</span>` :
                                        `<span id="processing-message-${index}" style="color: #999; font-size: 18px; font-weight: 500;">In queue</span>`
                                    }
                                </div>
                                <span style="font-weight: 600; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 24px;">${essay.studentName}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 20px; flex-shrink: 0;">
                                <label style="display: flex; align-items: center; gap: 10px; margin: 0; cursor: pointer; pointer-events: auto;" onclick="event.stopPropagation();">
                                    <input type="checkbox" class="mark-complete-checkbox" data-student-index="${index}" style="margin: 0; transform: scale(2);">
                                    <span style="font-size: 20px; color: #666; white-space: nowrap; font-weight: 600;">Mark Complete</span>
                                </label>
                                <button onclick="event.stopPropagation(); downloadIndividualEssay(${index})" disabled style="background: #6c757d; color: white; border: none; padding: 16px 24px; border-radius: 8px; font-size: 18px; cursor: not-allowed; white-space: nowrap; pointer-events: auto; font-weight: 600;">Download</button>
                            </div>
                        </div>
                        <div id="student-details-${index}" style="max-height: 0px; overflow: hidden; transition: max-height 0.3s ease-in-out; border-top: 1px solid #ddd;">
                            <div id="batch-essay-${index}" style="padding: 15px;">${getClaudeLoadingMessage()}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;

    resultsDiv.innerHTML = progressHtml;
    resultsDiv.style.display = 'block';

    console.log('✅ Batch progress UI displayed');

    // Set up rotating Claude message for the first essay only
    // Start with "Processing..." then switch to funny messages after 10 seconds
    if (batchData.essays.length > 0) {
        const firstEssayMessageElement = document.getElementById('processing-message-0');
        if (firstEssayMessageElement) {
            // After 10 seconds, start rotating funny messages
            setTimeout(() => {
                // Only switch if still processing
                if (firstEssayMessageElement.textContent === 'Processing...') {
                    firstEssayMessageElement.textContent = getClaudeLoadingMessage();

                    // Now set up interval for continued rotation
                    window.claudeMessageTimer = setInterval(() => {
                        // Only update if still showing a Claude message (not if completed)
                        const currentText = firstEssayMessageElement.textContent;
                        if (currentText !== 'Processing...' && !currentText.includes('✓') && !currentText.includes('✗')) {
                            firstEssayMessageElement.textContent = getClaudeLoadingMessage();
                        }
                    }, 10000); // Update every 10 seconds
                }
            }, 10000); // Wait 10 seconds before first funny message
        }
    }
}

/**
 * Update individual essay status in the progress UI
 * @param {number} index - Essay index
 * @param {boolean} success - Whether the essay was successfully graded
 * @param {string} error - Error message if failed
 */
function updateEssayStatus(index, success, error = null) {
    const statusElement = document.getElementById(`student-status-${index}`);
    if (!statusElement) return;

    // Clear the Claude message timer when the first essay status is updated
    if (index === 0 && window.claudeMessageTimer) {
        clearInterval(window.claudeMessageTimer);
        window.claudeMessageTimer = null;
    }

    // Mark essay as completed
    processingQueue.completedEssays.push(index);

    if (success) {
        statusElement.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="2">
                <path d="M20 6L9 17l-5-5"></path>
            </svg>
        `;

        // Enable the download button for successful essays
        const studentRow = document.getElementById(`student-row-${index}`);
        if (studentRow) {
            const downloadBtn = studentRow.querySelector('button[onclick*="downloadIndividualEssay"]');
            if (downloadBtn) {
                downloadBtn.disabled = false;
                downloadBtn.style.background = '#007bff';
                downloadBtn.style.cursor = 'pointer';
            }
        }
    } else {
        statusElement.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M15 9l-6 6M9 9l6 6"></path>
            </svg>
            ${error ? `<div style="font-size: 11px; color: #666; margin-left: 8px;">${error}</div>` : ''}
        `;
    }

    // Activate next essay in queue if there is one
    if (processingQueue.nextInQueue < processingQueue.totalEssays) {
        const nextIndex = processingQueue.nextInQueue;
        const nextStatusElement = document.getElementById(`student-status-${nextIndex}`);

        if (nextStatusElement) {
            // Update from "In queue" to "Processing..."
            nextStatusElement.innerHTML = `
                <div class="loading-spinner" id="spinner-${nextIndex}" style="width: 24px; height: 24px; border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <span id="processing-message-${nextIndex}" style="color: #666; font-size: 18px; font-weight: 500;">Processing...</span>
            `;
        }

        processingQueue.nextInQueue++;
    }
}

/**
 * Display batch grading results
 * @param {Object} batchResult - The batch grading result
 * @param {Object} originalData - The original form data
 */
function displayBatchResults(batchResult, originalData) {
    console.log('🎯 DISPLAY BATCH RESULTS CALLED');
    console.log('Batch result:', batchResult);
    console.log('Original data:', originalData);

    // Update loading indicators to checkmarks progressively
    if (batchResult.results) {
        batchResult.results.forEach((essay, index) => {
            setTimeout(() => {
                // Update the status indicator with success/failure
                updateEssayStatus(index, essay.success, essay.error);

                if (window.EssayManagementModule) {
                    window.EssayManagementModule.markStudentComplete(index, essay.success);
                }
            }, index * 200); // 200ms delay between each completion
        });
    }

    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;

    // Create compact batch results UI
    if (!batchResult.results) {
        console.error('No results found in batch result:', batchResult);
        resultsDiv.innerHTML = '<div class="error">Error: No results found in batch grading response</div>';
        resultsDiv.style.display = 'block';
        return;
    }

    const successCount = batchResult.results.filter(r => r.success).length;
    const failureCount = batchResult.results.filter(r => !r.success).length;

    const compactHtml = window.DisplayUtilsModule ?
        window.DisplayUtilsModule.createBatchResultsHTML(batchResult, successCount, failureCount) :
        createBatchResultsHTMLFallback(batchResult, successCount, failureCount);

    resultsDiv.innerHTML = compactHtml;
    resultsDiv.style.display = 'block';

    // Store batch data globally for download and expand functions
    window.currentBatchData = { batchResult, originalData };

    // Store essay data for lazy loading when expanded
    if (batchResult.results && originalData && originalData.essays) {
        batchResult.results.forEach((essay, index) => {
            if (essay.success) {
                const essayFromOriginal = originalData.essays[index];
                window[`essayData_${index}`] = {
                    essay: essay,
                    originalData: {
                        ...essayFromOriginal,
                        index: index
                    }
                };
            }
        });
    }
}

/**
 * Toggle student details in batch results
 * @param {number} index - Student index
 */
function toggleStudentDetails(index) {
    const detailsDiv = document.getElementById(`student-details-${index}`);

    if (!detailsDiv) return;

    // Check if currently closed (max-height is 0 or not set to a large value)
    const isCurrentlyClosed = detailsDiv.style.maxHeight === '0px' || detailsDiv.style.maxHeight === '' || detailsDiv.style.maxHeight === '0';

    if (isCurrentlyClosed) {
        // Open the dropdown
        detailsDiv.style.maxHeight = '5000px'; // Large enough for any essay content
        loadEssayDetails(index);
    } else {
        // Close the dropdown
        detailsDiv.style.maxHeight = '0px';
    }
}

/**
 * Load essay details for batch result expansion
 * @param {number} index - Essay index
 */
function loadEssayDetails(index) {
    const essayDiv = document.getElementById(`batch-essay-${index}`);
    if (!essayDiv || !window[`essayData_${index}`]) return;

    // Only load if not already loaded (contains one of the initial Claude messages from the dropdown)
    const initialClaudeMessages = ["🤔 Cogitating", "✨ Percolating", "🔮 Ruminating", "💭 Mulling", "🌀 Churning",
                                   "🎯 Calibrating", "📚 Parsing", "🧠 Neurons", "⚡ Synapses", "🔍 Scrutinizing",
                                   "💡 Illuminating", "🎨 Crafting", "🌟 Crystallizing", "📖 Decoding", "🎭 Contemplating",
                                   "🔬 Analyzing", "🌈 Synthesizing", "🎪 Juggling", "🎢 Navigating", "🎪 Orchestrating",
                                   "💪 Working", "🧠 Thinking", "🤗 I'm trying"];
    const containsInitialMessage = initialClaudeMessages.some(msg => essayDiv.innerHTML.includes(msg));

    if (containsInitialMessage || essayDiv.innerHTML.includes('Loading formatted result...')) {
        const { essay, originalData } = window[`essayData_${index}`];

        // Show loading spinner with Claude-style message
        const loadingMessage = getClaudeLoadingMessage();
        essayDiv.innerHTML = window.DisplayUtilsModule ?
            window.DisplayUtilsModule.createLoadingSpinner(loadingMessage) :
            `<div style="padding: 20px; font-size: 16px; color: #666;">${loadingMessage}</div>`;

        fetch('/format', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                studentText: originalData.studentText,
                gradingResults: essay.result,
                studentName: essay.studentName,
                editable: true
            })
        })
        .then(response => response.json())
        .then(formatted => {
            if (formatted.success) {
                const essayHTML = window.DisplayUtilsModule ?
                    window.DisplayUtilsModule.createBatchEssayHTML(formatted, index) :
                    createBatchEssayHTMLFallback(formatted, index);

                essayDiv.innerHTML = essayHTML;

                // Initialize essay editing for this batch item AFTER content is loaded
                setTimeout(() => {
                    console.log('🔄 Initializing essay editing features for index:', index);

                    // Initialize text selection
                    const essayContentDiv = document.querySelector(`.formatted-essay-content[data-essay-index="${index}"]`);
                    if (essayContentDiv) {
                        console.log('✅ Found essay content div, setting up text selection');
                        essayContentDiv.addEventListener('mouseup', (e) => {
                            console.log('🖱️ Mouseup event in essay content, target:', e.target);

                            // Get current selection to check if user is actually selecting text
                            const selection = window.getSelection();
                            const hasTextSelection = selection.rangeCount > 0 && !selection.isCollapsed;

                            console.log('📝 Selection status:', {
                                hasSelection: hasTextSelection,
                                selectedText: hasTextSelection ? selection.toString().trim() : '',
                                rangeCount: selection.rangeCount
                            });

                            // If user has selected text, allow highlighting even within existing highlights
                            if (hasTextSelection) {
                                console.log('✅ User has text selected, proceeding with highlighting');
                                if (window.TextSelectionModule) {
                                    window.TextSelectionModule.handleBatchTextSelection(e, index);
                                }
                                return;
                            }

                            // If no text selection, check if user clicked on an existing highlight
                            if (e.target.tagName === 'SPAN' || e.target.tagName === 'MARK') {
                                console.log('🎯 User clicked on existing highlight with no selection, skipping text selection');
                                return;
                            }

                            // Check if click was inside a highlight (but no text selected)
                            const highlightParent = e.target.closest('span[data-category], mark[data-category]');
                            if (highlightParent) {
                                console.log('🎯 User clicked inside highlight with no selection, skipping text selection');
                                return;
                            }

                            // For other clicks, still process through text selection module
                            if (window.TextSelectionModule) {
                                window.TextSelectionModule.handleBatchTextSelection(e, index);
                            }
                        });
                    } else {
                        console.log('❌ Could not find essay content div for index:', index);
                    }

                    // Initialize category buttons
                    const categoryButtons = document.querySelectorAll(`#categoryButtons-${index} .category-btn`);
                    console.log(`📝 Found ${categoryButtons.length} category buttons for index ${index}`);

                    categoryButtons.forEach(btn => {
                        btn.addEventListener('click', function(e) {
                            e.preventDefault();
                            const category = this.dataset.category;
                            console.log('🏷️ Category button clicked:', category);

                            if (window.CategorySelectionModule) {
                                window.CategorySelectionModule.selectBatchCategory(category, index);
                            } else if (window.TextSelectionModule) {
                                // Fallback: directly set category and apply
                                window.TextSelectionModule.setSelectedCategory(category, index);
                            }
                        });
                    });

                    // Initialize existing highlights
                    if (window.HighlightingModule) {
                        const essayContainer = document.getElementById(`batch-essay-${index}`);
                        if (essayContainer) {
                            console.log('🎨 Ensuring highlight click handlers for container:', essayContainer);

                            // Check for both span and mark elements from GPT highlighting
                            const gptHighlights = essayContainer.querySelectorAll('span[style*="background"], span[class*="highlight"], span[style*="color"], mark[data-type], mark.highlighted-segment');
                            console.log(`🔍 Found ${gptHighlights.length} GPT highlights`);
                            console.log('GPT highlights found:', gptHighlights);

                            // Add click handlers to GPT highlights
                            gptHighlights.forEach((element, i) => {
                                // Extract category from data-type attribute or style/class
                                let category = 'unknown';

                                // Check for data-type attribute (GPT mark elements)
                                if (element.dataset.type) {
                                    const dataType = element.dataset.type;
                                    if (dataType.includes('grammar')) {
                                        category = 'grammar';
                                    } else if (dataType.includes('vocabulary')) {
                                        category = 'vocabulary';
                                    } else if (dataType.includes('spelling')) {
                                        category = 'spelling';
                                    } else if (dataType.includes('mechanics')) {
                                        category = 'mechanics';
                                    } else if (dataType.includes('fluency')) {
                                        category = 'fluency';
                                    }
                                } else {
                                    // Fallback: try to determine category from color/class
                                    const styleMatch = element.style.backgroundColor?.match(/rgb.*|#/);
                                    if (styleMatch || element.className.includes('highlight')) {
                                        if (element.style.backgroundColor?.includes('255, 140') || element.className.includes('grammar')) {
                                            category = 'grammar';
                                        } else if (element.style.backgroundColor?.includes('0, 163') || element.className.includes('vocabulary')) {
                                            category = 'vocabulary';
                                        } else if (element.style.backgroundColor?.includes('220, 20') || element.className.includes('spelling')) {
                                            category = 'spelling';
                                        } else if (element.style.backgroundColor?.includes('211, 211') || element.className.includes('mechanics')) {
                                            category = 'mechanics';
                                        } else if (element.style.backgroundColor?.includes('135, 206') || element.className.includes('fluency')) {
                                            category = 'fluency';
                                        }
                                    }
                                }

                                // Add required attributes
                                element.dataset.category = category;
                                element.dataset.originalText = element.textContent;
                                element.style.cursor = 'pointer';
                                element.title = `Click to edit ${category} highlight`;

                                // Add click handler with capturing
                                element.addEventListener('click', function(e) {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    console.log('🖱️ GPT highlight clicked:', this);
                                    console.log('📊 Element details:', {
                                        tagName: this.tagName,
                                        category: this.dataset.category,
                                        text: this.textContent,
                                        style: this.style.cssText,
                                        dataType: this.dataset.type
                                    });
                                    if (window.HighlightingModule) {
                                        window.HighlightingModule.editHighlight(this);
                                    }
                                }, true); // Use capturing phase

                                // Also add mousedown handler as backup
                                element.addEventListener('mousedown', function(e) {
                                    console.log('🖱️ GPT highlight mousedown:', this);
                                    e.stopPropagation();
                                }, true);

                                console.log(`✅ Added click handler to GPT highlight ${i}: ${category}`);
                            });

                            // Still run the original function for mark elements
                            window.HighlightingModule.ensureHighlightClickHandlers(essayContainer);
                        }
                    }

                    // Initialize the main essay editing module
                    if (window.EssayEditingModule) {
                        window.EssayEditingModule.initializeBatchEssayEditing(index, essay.result, originalData);
                    }

                    // Setup editable elements for score inputs (critical for batch processing)
                    if (window.SingleResultModule && window.SingleResultModule.setupBatchEditableElements) {
                        console.log('🔧 Setting up batch editable elements for essay', index);
                        window.SingleResultModule.setupBatchEditableElements(essay.result, originalData, index);
                    }
                }, 200); // Slightly longer delay to ensure DOM is ready
            } else {
                const errorHTML = window.DisplayUtilsModule ?
                    window.DisplayUtilsModule.createErrorHTML('Error formatting essay', formatted.error) :
                    '<div class="error">Error formatting essay</div>';
                essayDiv.innerHTML = errorHTML;
            }
        })
        .catch(error => {
            console.error('Error loading essay details:', error);
            const errorHTML = window.DisplayUtilsModule ?
                window.DisplayUtilsModule.createErrorHTML('Error loading essay details', error.message) :
                '<div class="error">Error loading essay details</div>';
            essayDiv.innerHTML = errorHTML;
        });
    }
}

/**
 * Download individual essay
 * @param {number} index - Essay index
 */
function downloadIndividualEssay(index) {
    console.log('Downloading essay for student index:', index);

    const essayData = window[`essayData_${index}`];
    if (!essayData) {
        console.error('No essay data found for index:', index);
        return;
    }

    // Use PDF export module if available
    if (window.PDFExportModule && window.PDFExportModule.exportIndividualEssay) {
        window.PDFExportModule.exportIndividualEssay(essayData);
    } else {
        // Fallback implementation
        console.log('PDF export not available, essay data:', essayData);
        showError('PDF export functionality is not available.', 'PDF Export Error');
    }
}

/**
 * Download all essays
 */
function downloadAllEssays() {
    console.log('Downloading all essays');

    if (!window.currentBatchData) {
        console.error('No batch data available for download');
        return;
    }

    // Use PDF export module if available
    if (window.PDFExportModule && window.PDFExportModule.exportBatchEssays) {
        window.PDFExportModule.exportBatchEssays(window.currentBatchData);
    } else {
        // Fallback implementation
        console.log('PDF export not available, batch data:', window.currentBatchData);
        showError('PDF export functionality is not available.', 'PDF Export Error');
    }
}

/**
 * Mark student as complete in batch processing
 * @param {number} index - Student index
 * @param {boolean} completed - Whether to mark as completed
 */
function markStudentComplete(index, completed = true) {
    const checkbox = document.querySelector(`.mark-complete-checkbox[data-student-index="${index}"]`);
    if (checkbox) {
        checkbox.checked = completed;

        // Update visual indicators
        const studentRow = checkbox.closest('.student-row');
        if (studentRow) {
            if (completed) {
                studentRow.style.opacity = '0.7';
                studentRow.style.backgroundColor = '#f8f9fa';
            } else {
                studentRow.style.opacity = '1';
                studentRow.style.backgroundColor = '';
            }
        }
    }
}

/**
 * Get completion status for batch processing
 * @returns {Object} Completion statistics
 */
function getBatchCompletionStatus() {
    const checkboxes = document.querySelectorAll('.mark-complete-checkbox');
    const total = checkboxes.length;
    const completed = Array.from(checkboxes).filter(cb => cb.checked).length;

    return {
        total: total,
        completed: completed,
        remaining: total - completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
}

/**
 * Update batch progress display
 */
function updateBatchProgress() {
    const status = getBatchCompletionStatus();
    const progressElement = document.getElementById('batchProgress');

    if (progressElement) {
        progressElement.innerHTML = `
            <div class="progress-bar" style="width: 100%; background: #f0f0f0; border-radius: 4px; overflow: hidden;">
                <div style="width: ${status.percentage}%; background: #28a745; height: 20px; transition: width 0.3s;"></div>
            </div>
            <div style="text-align: center; margin-top: 5px; font-size: 14px;">
                ${status.completed}/${status.total} completed (${status.percentage}%)
            </div>
        `;
    }
}

/**
 * Setup batch processing event listeners
 */
function setupBatchProcessing() {
    // Listen for completion checkbox changes
    document.addEventListener('change', function(event) {
        if (event.target.classList.contains('mark-complete-checkbox')) {
            updateBatchProgress();
        }
    });

    // Setup auto-save for completion status
    document.addEventListener('change', function(event) {
        if (event.target.classList.contains('mark-complete-checkbox')) {
            const index = event.target.dataset.studentIndex;
            const completed = event.target.checked;

            // Save to localStorage for persistence
            const completionData = JSON.parse(localStorage.getItem('batchCompletion') || '{}');
            completionData[index] = completed;
            localStorage.setItem('batchCompletion', JSON.stringify(completionData));
        }
    });
}

/**
 * Restore batch completion status from localStorage
 */
function restoreBatchCompletionStatus() {
    const completionData = JSON.parse(localStorage.getItem('batchCompletion') || '{}');

    Object.entries(completionData).forEach(([index, completed]) => {
        markStudentComplete(parseInt(index), completed);
    });

    updateBatchProgress();
}

/**
 * Clear batch completion status
 */
function clearBatchCompletionStatus() {
    localStorage.removeItem('batchCompletion');
    document.querySelectorAll('.mark-complete-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    updateBatchProgress();
}

/**
 * Fallback implementations for when DisplayUtilsModule is not available
 */
function createBatchResultsHTMLFallback(batchResult, successCount, failureCount) {
    return `
        <div class="batch-results">
            <h2>Grading Results (${batchResult.totalEssays} essays)</h2>
            <div class="batch-summary" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p><strong>Summary:</strong> ${successCount} successful, ${failureCount} failed</p>
            </div>
            <div class="compact-student-list" style="margin: 20px 0;">
                ${batchResult.results.map((essay, index) => `
                    <div class="student-row" style="border: 2px solid #ddd; margin: 16px 0; padding: 24px; border-radius: 8px; min-height: 60px;">
                        <div onclick="toggleStudentDetails(${index})" style="cursor: pointer; font-size: 22px; font-weight: 500; display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 24px;">${essay.success ? '✅' : '❌'}</span>
                            <span>${essay.studentName}</span>
                        </div>
                        <div id="student-details-${index}" style="display: none;">
                            ${essay.success ? `<div id="batch-essay-${index}">Loading...</div>` : `Error: ${essay.error}`}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function createBatchEssayHTMLFallback(formatted, index) {
    return `
        <div>
            ${formatted.feedbackSummary}
            <div class="formatted-essay-content" data-essay-index="${index}">
                ${formatted.formattedText}
            </div>
        </div>
    `;
}

// Export functions for module usage
window.BatchProcessingModule = {
    displayBatchProgress,
    updateEssayStatus,
    displayBatchResults,
    toggleStudentDetails,
    loadEssayDetails,
    downloadIndividualEssay,
    downloadAllEssays,
    markStudentComplete,
    getBatchCompletionStatus,
    updateBatchProgress,
    setupBatchProcessing,
    restoreBatchCompletionStatus,
    clearBatchCompletionStatus
};