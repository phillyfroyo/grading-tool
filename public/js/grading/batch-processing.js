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
        "🌀 Churning through ideas...",
        "🧠 Neurons firing...",
        "⚡ Synapses sparking...",
        "💪 Working hard...",
        "🧠 Thinking vigorously...",
        "🤗 I'm trying my best...",
        "🪐 Contemplating reality...",
        "🧘 Finding inner peace...",
        "☕ Brewing thoughts...",
        "🤯 Having an existential moment...",
        "🦉 Channeling ancient wisdom...",
        "🧙 Casting analysis spell...",
        "💫 Achieving enlightenment...",
        "📡 Downloading wisdom...",
        "🐢 Slow and steady wins the race...",
        "🎩 Pulling insights from within...",
        "🤓 Adjusting my glasses...",
        "🎲 Searching for intelligence...",
        "📚 Reading between the lines...",
        "🎭 Weighing nuance carefully...",
        "🌊 Swimming through paragraphs...",
        "🔬 Examining with great care...",
        "💭 Lost in thought (productively)...",
        "📝 Pondering pedagogically..."
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Display initial batch grading progress UI
 * @param {Object} batchData - The batch data being processed
 */
function displayBatchProgress(batchData) {
    // Initialize queue tracking
    processingQueue = {
        currentlyProcessing: Math.min(2, batchData.essays.length),
        maxConcurrent: 2,
        totalEssays: batchData.essays.length,
        completedEssays: [],
        nextInQueue: 2
    };

    // Find the results div in the active tab
    const activeTab = document.querySelector('.tab-content.active');
    const resultsDiv = activeTab ? activeTab.querySelector('#results') : document.getElementById('results');
    if (!resultsDiv) return;

    // Create the progress UI immediately
    const progressHtml = `
        <div class="batch-results">
            <h2 style="font-size: 20px; margin-bottom: 12px;">Grading ${batchData.essays.length} Essays. This will take a few minutes.</h2>
            <div style="background: #fff3cd; border: 2px solid #ffc107; padding: 12px; border-radius: 6px; margin: 12px 0; color: #856404; font-size: 14px; line-height: 1.4; font-weight: 500;">
                <strong style="font-size: 15px;">⚠️</strong> The AI will make mistakes. Please review all essays and make any necessary manual edits.
            </div>
            <div class="compact-student-list" style="margin: 12px 0;">
                ${batchData.essays.map((essay, index) => `
                    <div class="student-row" id="student-row-${index}" style="border: 2px solid #ddd; margin: 10px 0; border-radius: 6px; overflow: hidden;">
                        <!-- Student Name Header (clickable to expand grade details) -->
                        <div class="student-header-clickable" onclick="toggleTab('grade-details-${index}', ${index})" style="
                            padding: 12px 18px;
                            background: #f8f9fa;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            font-size: 15px;
                            font-weight: 500;
                            min-height: 40px;
                            border-bottom: 1px solid #ddd;
                            cursor: pointer;
                            transition: background-color 0.2s;
                            user-select: none;
                        " onmouseover="this.style.backgroundColor='#e9ecef'"
                           onmouseout="this.style.backgroundColor='#f8f9fa'">
                            <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                                <span id="grade-details-${index}-arrow" style="font-size: 14px; transition: transform 0.3s; display: inline-block;">▼</span>
                                <div id="student-status-${index}" class="student-status" style="display: flex; align-items: center; gap: 8px;">
                                    ${index < 2 ?
                                        `<div class="loading-spinner" id="spinner-${index}" style="width: 18px; height: 18px; border: 2px solid #f3f3f3; border-top: 2px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                                        <span id="processing-message-${index}" style="color: #666; font-size: 14px; font-weight: 500;">Processing...</span>` :
                                        `<span id="processing-message-${index}" style="color: #999; font-size: 14px; font-weight: 500;">In queue</span>`
                                    }
                                </div>
                                <span style="font-weight: 600; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 16px;">${essay.studentName}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                                <label style="display: flex; align-items: center; gap: 6px; margin: 0; cursor: pointer;" onclick="event.stopPropagation();">
                                    <input type="checkbox" class="mark-complete-checkbox" data-student-index="${index}" style="margin: 0; transform: scale(1.3);">
                                    <span style="font-size: 14px; color: #666; white-space: nowrap; font-weight: 600;">Mark Complete</span>
                                </label>
                                <button onclick="event.stopPropagation(); downloadIndividualEssay(${index})" disabled style="background: #6c757d; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-size: 14px; cursor: not-allowed; white-space: nowrap; font-weight: 600;">Download</button>
                            </div>
                        </div>

                        <!-- Grade Details Content (directly under student name) -->
                        <div id="grade-details-${index}" class="tab-content" style="
                            max-height: 0;
                            overflow: hidden;
                            transition: max-height 0.3s ease-out;
                            background: white;
                        ">
                            <div id="batch-essay-${index}" style="padding: 12px;">${getClaudeLoadingMessage()}</div>
                        </div>

                        <!-- Highlights Management Tab -->
                        <div class="tab-header" style="
                            background: #ffffff;
                            border-bottom: 1px solid #ddd;
                            user-select: none;
                        ">
                            <div style="display: flex; flex-direction: column; flex: 1;">
                                <!-- Upper section: Title and arrow (clickable for toggle) -->
                                <div onclick="toggleTab('highlights-tab-${index}', ${index})" style="
                                    padding: 10px 18px;
                                    cursor: pointer;
                                    display: flex;
                                    align-items: center;
                                    gap: 8px;
                                    transition: background-color 0.2s;
                                " onmouseover="this.style.backgroundColor='#f8f9fa'"
                                   onmouseout="this.style.backgroundColor='#ffffff'">
                                    <span id="highlights-tab-${index}-arrow" style="font-size: 14px; transition: transform 0.3s; display: inline-block;">▼</span>
                                    <span style="font-weight: 600; font-size: 14px;">Manage 'Highlights and Corrections' as seen on the exported PDF</span>
                                </div>
                                <!-- Lower section: Checkbox (independent hover) -->
                                <label style="
                                    display: flex;
                                    align-items: center;
                                    gap: 6px;
                                    padding: 6px 18px 10px 40px;
                                    font-size: 13px;
                                    cursor: pointer;
                                    transition: background-color 0.2s;
                                " onclick="event.stopPropagation();"
                                   onmouseover="this.style.backgroundColor='#f8f9fa'"
                                   onmouseout="this.style.backgroundColor='#ffffff'">
                                    <input type="checkbox" id="highlights-tab-${index}-remove-all" class="remove-all-checkbox" data-content-id="highlights-tab-content-${index}" style="cursor: pointer; width: 14px; height: 14px;">
                                    <span style="color: #666;">Remove all from PDF</span>
                                </label>
                            </div>
                        </div>
                        <div id="highlights-tab-${index}" class="tab-content" style="
                            max-height: 0;
                            overflow: hidden;
                            transition: max-height 0.3s ease-out;
                            background: white;
                        ">
                            <div id="highlights-tab-content-${index}" style="padding: 15px;">Loading highlights...</div>
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

    // Set up rotating Claude message for the first essay only
    // Start with "Processing..." then switch to funny messages after 3 seconds
    if (batchData.essays.length > 0) {
        const firstEssayMessageElement = document.getElementById('processing-message-0');
        if (firstEssayMessageElement) {
            // After 3 seconds, start rotating funny messages
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
                    }, 6000); // Update every 6 seconds
                }
            }, 4000); // Wait 4 seconds before first funny message
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
            <div style="display: flex; align-items: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M15 9l-6 6M9 9l6 6"></path>
                </svg>
                <span style="color: #dc3545; font-weight: 500;">Failed</span>
                <button onclick="window.BatchProcessingModule.retryEssay(${index})"
                        style="padding: 4px 10px; font-size: 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;"
                        onmouseover="this.style.background='#0056b3'"
                        onmouseout="this.style.background='#007bff'">
                    Retry
                </button>
            </div>
            ${error ? `<div style="font-size: 11px; color: #666; margin-top: 4px;">${error}</div>` : ''}
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
                <span id="processing-message-${nextIndex}" style="color: #666; font-size: 14px; font-weight: 500;">Processing...</span>
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

    // Find the results div in the active tab
    const activeTab = document.querySelector('.tab-content.active');
    const resultsDiv = activeTab ? activeTab.querySelector('#results') : document.getElementById('results');
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

    // Capture checkbox states BEFORE replacing HTML
    const checkboxStates = {};
    document.querySelectorAll('.remove-all-checkbox').forEach(checkbox => {
        const contentId = checkbox.dataset.contentId;
        if (contentId && checkbox.checked) {
            checkboxStates[contentId] = true;
            console.log(`💾 Captured checked state for ${contentId}`);
        }
    });

    const compactHtml = window.DisplayUtilsModule ?
        window.DisplayUtilsModule.createBatchResultsHTML(batchResult, successCount, failureCount) :
        createBatchResultsHTMLFallback(batchResult, successCount, failureCount);

    resultsDiv.innerHTML = compactHtml;
    resultsDiv.style.display = 'block';

    // Restore checkbox states AFTER HTML is replaced
    setTimeout(() => {
        Object.entries(checkboxStates).forEach(([contentId, isChecked]) => {
            const checkbox = document.querySelector(`.remove-all-checkbox[data-content-id="${contentId}"]`);
            if (checkbox && isChecked) {
                checkbox.checked = true;
                localStorage.setItem(`removeAllFromPDF_${contentId}`, 'true');
                console.log(`✅ Restored checked state for ${contentId}`);
            }
        });
    }, 50);

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
                        index: index,
                        classProfile: originalData.classProfile || null
                    }
                };
            }
        });
    }

    // Show auto-save banner
    if (window.AutoSaveModule) {
        window.AutoSaveModule.showClearButton('Grading complete');
    }
}

/**
 * Toggle student details in batch results
 * @param {number} index - Student index
 */
function toggleStudentDetails(index) {
    const detailsDiv = document.getElementById(`student-details-${index}`);
    const arrow = document.getElementById(`student-arrow-${index}`);

    if (!detailsDiv) return;

    // Check if currently closed (max-height is 0 or not set to a large value)
    const isCurrentlyClosed = detailsDiv.style.maxHeight === '0px' || detailsDiv.style.maxHeight === '' || detailsDiv.style.maxHeight === '0';

    if (isCurrentlyClosed) {
        // Open the dropdown with smooth animation
        detailsDiv.style.maxHeight = detailsDiv.scrollHeight + 'px';
        if (arrow) arrow.style.transform = 'rotate(180deg)';
        loadEssayDetails(index);

        // After content loads, adjust height if needed
        setTimeout(() => {
            if (detailsDiv.scrollHeight > parseInt(detailsDiv.style.maxHeight)) {
                detailsDiv.style.maxHeight = detailsDiv.scrollHeight + 'px';
            }
        }, 100);
    } else {
        // Close the dropdown
        detailsDiv.style.maxHeight = '0px';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
}

// Track which essays are currently being loaded to prevent duplicate fetches
const essayLoadingLock = {};

/**
 * Load essay details for batch result expansion
 * @param {number} index - Essay index
 */
function loadEssayDetails(index) {
    const essayDiv = document.getElementById(`batch-essay-${index}`);

    if (!essayDiv || !window[`essayData_${index}`]) return;

    // LOCK: Prevent duplicate concurrent loads for the same essay
    if (essayLoadingLock[index]) {
        return;
    }

    // Check if already loaded (has formatted content with correct index)
    const alreadyLoaded = essayDiv.querySelector(`.formatted-essay-content[data-essay-index="${index}"]`);
    if (alreadyLoaded) {
        return;
    }

    // Set the lock
    essayLoadingLock[index] = true;

    const { essay, originalData } = window[`essayData_${index}`];

    // Show loading spinner with Claude-style message
    const loadingMessage = getClaudeLoadingMessage();
    essayDiv.innerHTML = window.DisplayUtilsModule ?
        window.DisplayUtilsModule.createLoadingSpinner(loadingMessage) :
        `<div style="padding: 12px; font-size: 14px; color: #666;">${loadingMessage}</div>`;

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

            // Release lock - loading complete
            essayLoadingLock[index] = false;

            // IMMEDIATE verification: confirm content loaded into correct div
            const verifyDiv = document.getElementById(`batch-essay-${index}`);
            const verifyContent = verifyDiv?.querySelector(`.formatted-essay-content[data-essay-index="${index}"]`);
            if (!verifyContent) {
                console.error(`❌ Essay ${index} content verification FAILED - content did not load correctly`);
                // Mark as failed immediately
                updateEssayStatus(index, false, 'Content failed to load - please retry');
                return; // Don't continue initialization
            }

            // Initialize essay editing for this batch item AFTER content is loaded
                setTimeout(() => {
                    // Initialize text selection
                    const essayContentDiv = document.querySelector(`.formatted-essay-content[data-essay-index="${index}"]`);
                    if (essayContentDiv) {
                        essayContentDiv.addEventListener('mouseup', (e) => {
                            // Get current selection to check if user is actually selecting text
                            const selection = window.getSelection();
                            const hasTextSelection = selection.rangeCount > 0 && !selection.isCollapsed;

                            // If user has selected text, allow highlighting even within existing highlights
                            if (hasTextSelection) {
                                if (window.TextSelectionModule) {
                                    window.TextSelectionModule.handleBatchTextSelection(e, index);
                                }
                                return;
                            }

                            // If no text selection, check if user clicked on an existing highlight
                            if (e.target.tagName === 'SPAN' || e.target.tagName === 'MARK') {
                                return;
                            }

                            // Check if click was inside a highlight (but no text selected)
                            const highlightParent = e.target.closest('span[data-category], mark[data-category]');
                            if (highlightParent) {
                                return;
                            }

                            // For other clicks, still process through text selection module
                            if (window.TextSelectionModule) {
                                window.TextSelectionModule.handleBatchTextSelection(e, index);
                            }
                        });
                    }

                    // Initialize category buttons
                    const categoryButtons = document.querySelectorAll(`#categoryButtons-${index} .category-btn`);

                    categoryButtons.forEach(btn => {
                        btn.addEventListener('click', function(e) {
                            e.preventDefault();
                            const category = this.dataset.category;

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
                            // Check for both span and mark elements from GPT highlighting
                            const gptHighlights = essayContainer.querySelectorAll('span[style*="background"], span[class*="highlight"], span[style*="color"], mark[data-type], mark.highlighted-segment');

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
                                    } else if (dataType.includes('delete')) {
                                        category = 'delete';
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
                                        } else if (element.style.textDecoration?.includes('line-through') || element.className.includes('delete')) {
                                            category = 'delete';
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
                                    if (window.HighlightingModule) {
                                        window.HighlightingModule.editHighlight(this);
                                    }
                                }, true); // Use capturing phase

                                // Also add mousedown handler as backup
                                element.addEventListener('mousedown', function(e) {
                                    e.stopPropagation();
                                }, true);
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
                        window.SingleResultModule.setupBatchEditableElements(essay.result, originalData, index);
                    }

                    // Adjust height after all content is loaded
                    const detailsDiv = document.getElementById(`student-details-${index}`);
                    if (detailsDiv && detailsDiv.style.maxHeight !== '0px') {
                        detailsDiv.style.maxHeight = detailsDiv.scrollHeight + 'px';
                    }
                }, 200); // Slightly longer delay to ensure DOM is ready
            } else {
                // Release lock on formatting error
                essayLoadingLock[index] = false;
                const errorHTML = window.DisplayUtilsModule ?
                    window.DisplayUtilsModule.createErrorHTML('Error formatting essay', formatted.error) :
                    '<div class="error">Error formatting essay</div>';
                essayDiv.innerHTML = errorHTML;
                updateEssayStatus(index, false, 'Error formatting essay - please retry');
            }
        })
        .catch(error => {
            // Release lock on fetch error
            essayLoadingLock[index] = false;
            console.error(`❌ Essay ${index} fetch error:`, error);
            const errorHTML = window.DisplayUtilsModule ?
                window.DisplayUtilsModule.createErrorHTML('Error loading essay details', error.message) :
                '<div class="error">Error loading essay details</div>';
            essayDiv.innerHTML = errorHTML;
            // Mark as failed so retry button appears
            updateEssayStatus(index, false, 'Error loading essay - please retry');
        });
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
            <h2 style="font-size: 20px; margin-bottom: 12px;">Grading Results (${batchResult.totalEssays} essays)</h2>
            <div class="batch-summary" style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin: 10px 0; font-size: 14px;">
                <p style="margin: 0;"><strong>Summary:</strong> ${successCount} successful, ${failureCount} failed</p>
            </div>
            <div class="compact-student-list" style="margin: 12px 0;">
                ${batchResult.results.map((essay, index) => `
                    <div class="student-row" style="border: 2px solid #ddd; margin: 10px 0; padding: 12px 18px; border-radius: 6px; min-height: 40px;">
                        <div onclick="toggleStudentDetails(${index})" style="cursor: pointer; font-size: 15px; font-weight: 500; display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 18px;">${essay.success ? '✅' : '❌'}</span>
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

/**
 * Adjust student detail height after content changes
 * @param {number} index - Student index
 */
function adjustStudentDetailHeight(index) {
    const detailsDiv = document.getElementById(`student-details-${index}`);
    if (detailsDiv && detailsDiv.style.maxHeight !== '0px' && detailsDiv.style.maxHeight !== '') {
        // Only adjust if currently expanded
        setTimeout(() => {
            detailsDiv.style.maxHeight = detailsDiv.scrollHeight + 'px';
        }, 50);
    }
}

/**
 * Setup event listeners for highlight changes in batch processing
 */
function setupBatchHighlightListeners() {
    if (!window.eventBus) return;

    // Listen for highlight updates and removals
    window.eventBus.on('highlight:updated', () => {
        // Check all student details and adjust heights
        for (let i = 0; i < 50; i++) {
            adjustStudentDetailHeight(i);
        }
    });

    window.eventBus.on('highlight:removed', () => {
        // Check all student details and adjust heights
        for (let i = 0; i < 50; i++) {
            adjustStudentDetailHeight(i);
        }
    });
}

// Setup event listeners when module loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupBatchHighlightListeners);
} else {
    setupBatchHighlightListeners();
}

/**
 * Retry grading a single failed essay
 * @param {number} index - Essay index to retry
 */
async function retryEssay(index) {
    console.log(`🔄 Retrying essay at index ${index}`);

    // Clear the loading lock to allow fresh load
    essayLoadingLock[index] = false;

    // Get original batch data (stored separately from currentBatchData to avoid conflicts)
    const batchData = window.originalBatchDataForRetry;
    if (!batchData || !batchData.essays || !batchData.essays[index]) {
        console.error('❌ Cannot retry: original batch data not found');
        alert('Cannot retry: original essay data not found. Please refresh and try grading again.');
        return;
    }

    const essay = batchData.essays[index];

    // Update UI to show retrying
    const statusElement = document.getElementById(`student-status-${index}`);
    if (statusElement) {
        statusElement.innerHTML = `
            <div class="loading-spinner" style="width: 24px; height: 24px; border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <span style="color: #666; font-size: 14px; font-weight: 500;">Retrying...</span>
        `;
    }

    try {
        // Call the single essay grading endpoint
        const response = await fetch('/api/grade', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                studentText: essay.studentText,
                prompt: batchData.prompt,
                classProfile: batchData.classProfile,
                temperature: batchData.temperature,
                provider: batchData.provider,
                studentNickname: essay.studentNickname
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        if (result.success) {
            console.log(`✅ Retry successful for ${essay.studentName}`);

            // Store the essay data in the same format as batch processing
            window[`essayData_${index}`] = {
                essay: {
                    index: index,
                    success: true,
                    studentName: essay.studentName,
                    studentNickname: essay.studentNickname,
                    result: result
                },
                originalData: {
                    studentText: essay.studentText,
                    studentName: essay.studentName,
                    studentNickname: essay.studentNickname,
                    index: index,
                    classProfile: batchData.classProfile || null
                }
            };

            // Update status to success
            updateEssayStatus(index, true);

        } else {
            throw new Error(result.error || 'Grading returned unsuccessful');
        }

    } catch (error) {
        console.error(`❌ Retry failed for essay ${index}:`, error);
        updateEssayStatus(index, false, `Retry failed: ${error.message}`);
    }
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
    clearBatchCompletionStatus,
    retryEssay
};