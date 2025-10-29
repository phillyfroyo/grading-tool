/**
 * Display Utils Module
 * Utilities for creating and managing grading display elements
 */

/**
 * Create HTML for single essay display
 * @param {string} studentName - Student name
 * @param {Object} formatted - Formatted essay data
 * @returns {string} HTML string
 */
function createSingleEssayHTML(studentName, formatted) {
    return `
        <h2>Grading Results for ${studentName}</h2>
        ${formatted.feedbackSummary}
        <h3 style="margin: 20px 0 10px 0;">Color-Coded Essay:</h3>
        <div id="essayContainer" style="border: 1px solid #ddd; border-radius: 4px;">
            <!-- Category selector bar -->
            <div id="categoryBar" style="padding: 10px; background: #f8f9fa; border-bottom: 1px solid #ddd; border-radius: 4px 4px 0 0;">
                <div style="margin-bottom: 5px; font-weight: bold; font-size: 14px;">Select category then highlight text, or highlight text then select category:</div>
                <div id="categoryButtons" style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${createCategoryButtons()}
                    <button id="clearSelectionBtn" onclick="clearSelection()" style="background: #f5f5f5; color: #666; border: 2px solid #ccc; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-left: 10px;">Clear Selection</button>
                </div>
                <div id="selectionStatus" style="margin-top: 8px; font-size: 12px; color: #666; min-height: 16px;"></div>
            </div>
            <!-- Essay text area -->
            <div class="formatted-essay-content" style="padding: 15px; line-height: 1.6; user-select: text;">
                ${formatted.formattedText}
            </div>
            <!-- Color Legend -->
            ${createColorLegend()}
        </div>

        <!-- Highlights and Corrections Section -->
        ${createHighlightsUISection()}

        <div style="margin-top: 20px;">
            <button data-action="export-pdf">Export to PDF</button>
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
    return `
        ${formatted.feedbackSummary}
        <h3 style="margin: 20px 0 10px 0;">Color-Coded Essay:</h3>
        <div id="essayContainer-${index}" style="border: 1px solid #ddd; border-radius: 4px;">
            <!-- Category selector bar -->
            <div id="categoryBar-${index}" style="padding: 10px; background: #f8f9fa; border-bottom: 1px solid #ddd; border-radius: 4px 4px 0 0;">
                <div style="margin-bottom: 5px; font-weight: bold; font-size: 14px;">Select category then highlight text, or highlight text then select category:</div>
                <div id="categoryButtons-${index}" style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${createCategoryButtons(index)}
                    <button id="clearSelectionBtn-${index}" onclick="clearSelection(${index})" style="background: #f5f5f5; color: #666; border: 2px solid #ccc; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-left: 10px;">Clear Selection</button>
                </div>
                <div id="selectionStatus-${index}" style="margin-top: 8px; font-size: 12px; color: #666; min-height: 16px;"></div>
            </div>
            <!-- Essay text area -->
            <div class="formatted-essay-content" data-essay-index="${index}" style="
                padding: 15px;
                line-height: 1.6;
                user-select: text;
                min-height: 200px;
                max-height: none;
                overflow: visible;
                background: #fff;
                border: 1px solid #e0e0e0;
                border-radius: 4px;
                margin: 10px 0;
            ">
                ${formatted.formattedText}
            </div>
            <!-- Color Legend -->
            ${createColorLegend()}
        </div>

        <div style="margin-top: 30px; text-align: center;">
            <button onclick="downloadIndividualEssay(${index})" style="background: #007bff; color: white; border: none; padding: 32px 48px; border-radius: 12px; font-size: 36px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: all 0.2s;" onmouseover="this.style.background='#0056b3'; this.style.transform='scale(1.05)'" onmouseout="this.style.background='#007bff'; this.style.transform='scale(1)'">Export to PDF</button>
        </div>
    `;
}

/**
 * Create category buttons HTML
 * @param {string} essayIndex - Optional essay index for batch processing
 * @returns {string} HTML string for category buttons
 */
function createCategoryButtons(essayIndex = '') {
    if (window.CategorySelectionModule) {
        return window.CategorySelectionModule.createCategoryButtons(essayIndex);
    }

    // Fallback implementation
    const dataAttr = essayIndex ? ` data-essay-index="${essayIndex}"` : '';

    return `
        <button class="category-btn" data-category="grammar"${dataAttr} style="background: transparent; color: #FF8C00; border: 2px solid #FF8C00; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Grammar Error</button>
        <button class="category-btn" data-category="vocabulary"${dataAttr} style="background: transparent; color: #00A36C; border: 2px solid #00A36C; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Vocabulary Error</button>
        <button class="category-btn" data-category="mechanics"${dataAttr} style="background: #D3D3D3; color: #000000; border: 2px solid #D3D3D3; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Mechanics Error</button>
        <button class="category-btn" data-category="spelling"${dataAttr} style="background: transparent; color: #DC143C; border: 2px solid #DC143C; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Spelling Error</button>
        <button class="category-btn" data-category="fluency"${dataAttr} style="background: #87CEEB; color: #000000; border: 2px solid #87CEEB; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Fluency Error</button>
        <button class="category-btn" data-category="delete"${dataAttr} style="background: transparent; color: #000000; border: 2px solid #000000; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; text-decoration: line-through; transition: all 0.2s;">Delete Word</button>
    `;
}

/**
 * Create color legend HTML
 * @returns {string} HTML string for color legend
 */
function createColorLegend() {
    return `
        <div class="color-legend no-print" style="padding: 10px 15px; border-top: 1px solid #ddd; background: #f9f9f9; font-size: 12px; user-select: none; pointer-events: none;">
            <strong>Highlight Meanings:</strong>
            <mark class="legend-grammar" data-category="grammar" style="color: #FF8C00; font-weight: bold; margin-left: 10px; background: transparent;">grammar</mark>
            <mark class="legend-vocabulary" data-category="vocabulary" style="color: #00A36C; font-weight: bold; margin-left: 15px; background: transparent;">vocabulary</mark>
            <mark class="legend-spelling" data-category="spelling" style="color: #DC143C; font-weight: bold; margin-left: 15px; background: transparent;">spelling</mark>
            <mark class="legend-mechanics" data-category="mechanics" style="background: #D3D3D3; color: #000; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 15px;">mechanics</mark>
            <mark class="legend-fluency" data-category="fluency" style="background: #87CEEB; color: #000; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 15px;">fluency</mark>
            <mark class="legend-delete" data-category="delete" style="color: #000; text-decoration: line-through; font-weight: bold; margin-left: 15px; background: transparent;">delete</mark>
        </div>
    `;
}

/**
 * Create HTML for a single student row in batch results
 * @param {Object} essay - Essay result object
 * @param {number} index - Essay index
 * @param {string} statusIcon - HTML for status icon
 * @returns {string} HTML string
 */
function createStudentRowHTML(essay, index, statusIcon) {
    const backgroundColor = essay.success ? '#f8f9fa' : '#fff5f5';
    const textColor = essay.success ? '#333' : '#721c24';

    return `
        <div class="student-row" style="border: 2px solid #ddd; margin: 16px 0; border-radius: 8px; overflow: hidden;">
            <!-- Student Name Header (clickable to expand grade details) -->
            <div class="student-header-clickable" onclick="toggleTab('grade-details-${index}', ${index})" style="
                padding: 24px 30px;
                background: ${backgroundColor};
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 22px;
                font-weight: 500;
                min-height: 60px;
                border-bottom: 1px solid #ddd;
                cursor: pointer;
                transition: background-color 0.2s;
                user-select: none;
            " onmouseover="this.style.backgroundColor='${essay.success ? '#e9ecef' : '#ffe5e5'}'"
               onmouseout="this.style.backgroundColor='${backgroundColor}'">
                <div style="display: flex; align-items: center; gap: 15px; flex: 1; min-width: 0;">
                    <span id="grade-details-${index}-arrow" style="font-size: 18px; transition: transform 0.3s; display: inline-block;">▼</span>
                    <span style="font-size: 28px;">${statusIcon}</span>
                    <span style="font-weight: 600; color: ${textColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 24px;">${essay.studentName}</span>
                    ${!essay.success ? '<span style="color: #721c24; font-size: 20px; white-space: nowrap; font-weight: 500;">(Failed)</span>' : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 20px; flex-shrink: 0;">
                    <label style="display: flex; align-items: center; gap: 10px; margin: 0; cursor: pointer;" onclick="event.stopPropagation();">
                        <input type="checkbox" class="mark-complete-checkbox" data-student-index="${index}" style="margin: 0; transform: scale(2);">
                        <span style="font-size: 20px; color: #666; white-space: nowrap; font-weight: 600;">Mark Complete</span>
                    </label>
                    ${essay.success ? `<button onclick="event.stopPropagation(); downloadIndividualEssay(${index})" style="background: #007bff; color: white; border: none; padding: 16px 24px; border-radius: 8px; font-size: 18px; cursor: pointer; white-space: nowrap; font-weight: 600;">Download</button>` : ''}
                </div>
            </div>

            ${essay.success ? `
            <!-- Grade Details Content (directly under student name) -->
            <div id="grade-details-${index}" class="tab-content" style="
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.3s ease-out;
                background: white;
            ">
                <div id="batch-essay-${index}" style="padding: 15px;">Loading formatted result...</div>
            </div>

            <!-- Highlights Management Tab -->
            <div class="tab-header" onclick="toggleTab('highlights-tab-${index}', ${index})" style="
                padding: 15px 30px;
                background: #ffffff;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid #ddd;
                user-select: none;
                transition: background-color 0.2s;
            " onmouseover="this.style.backgroundColor='#f8f9fa'"
               onmouseout="this.style.backgroundColor='#ffffff'">
                <div style="display: flex; flex-direction: column; gap: 8px; flex: 1;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span id="highlights-tab-${index}-arrow" style="font-size: 18px; transition: transform 0.3s; display: inline-block;">▼</span>
                        <span style="font-weight: 600; font-size: 18px;">Manage 'Highlights and Corrections' as seen on the exported PDF</span>
                    </div>
                    <label style="display: flex; align-items: center; gap: 8px; margin-left: 30px; font-size: 14px; cursor: pointer;" onclick="event.stopPropagation();">
                        <input type="checkbox" id="highlights-tab-${index}-remove-all" class="remove-all-checkbox" data-content-id="highlights-tab-content-${index}" style="cursor: pointer; width: 16px; height: 16px;">
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
                <div id="highlights-tab-content-${index}" style="padding: 20px;">Loading highlights...</div>
            </div>
            ` : `
            <div style="padding: 15px; color: #721c24;">Error: ${essay.error}</div>
            `}
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
    let html = `
        <div class="batch-results">
            <h2>Grading Results (${batchResult.totalEssays} essays)</h2>
            <div style="background: #fff3cd; border: 2px solid #ffc107; padding: 20px; border-radius: 8px; margin: 20px 0; color: #856404; font-size: 18px; line-height: 1.5; font-weight: 500;">
                <strong style="font-size: 20px;">⚠️ Important:</strong> The AI will make mistakes. Please review all essays and make any necessary manual edits.
            </div>
            <div class="batch-summary" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p><strong>Summary:</strong> ${successCount} successful, ${failureCount} failed</p>
            </div>
            <div class="compact-student-list" style="margin: 20px 0;">
    `;

    // Create compact student list
    batchResult.results.forEach((essay, index) => {
        const statusIcon = essay.success ?
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="2"><path d="M20 6L9 17l-5-5"></path></svg>' :
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M15 9l-6 6M9 9l6 6"></path></svg>';

        html += createStudentRowHTML(essay, index, statusIcon);
    });

    html += `
            </div>
        </div>
    `;

    return html;
}

/**
 * Create loading spinner HTML
 * @param {string} message - Loading message
 * @returns {string} HTML string for loading spinner
 */
function createLoadingSpinner(message = 'Loading...') {
    return `
        <div class="loading-spinner" style="display: flex; align-items: center; justify-content: center; padding: 20px;">
            <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin-right: 10px;"></div>
            <span>${message}</span>
        </div>
        <style>
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        </style>
    `;
}

/**
 * Create error message HTML
 * @param {string} message - Error message
 * @param {string} details - Additional error details
 * @returns {string} HTML string for error display
 */
function createErrorHTML(message = 'An error occurred', details = '') {
    return `
        <div class="error-display" style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 4px; border: 1px solid #f5c6cb; margin: 20px 0;">
            <h3 style="margin-top: 0;">Error</h3>
            <p>${message}</p>
            ${details ? `<details><summary>Error Details</summary><pre style="margin-top: 10px; padding: 10px; background: #fff; border-radius: 4px; font-size: 12px;">${details}</pre></details>` : ''}
        </div>
    `;
}

/**
 * Create success message HTML
 * @param {string} message - Success message
 * @returns {string} HTML string for success display
 */
function createSuccessHTML(message = 'Operation completed successfully') {
    return `
        <div class="success-display" style="background: #d4edda; color: #155724; padding: 15px; border-radius: 4px; border: 1px solid #c3e6cb; margin: 20px 0;">
            <h3 style="margin-top: 0;">Success</h3>
            <p>${message}</p>
        </div>
    `;
}

/**
 * Create warning message HTML
 * @param {string} message - Warning message
 * @returns {string} HTML string for warning display
 */
function createWarningHTML(message = 'Warning') {
    return `
        <div class="warning-display" style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 4px; border: 1px solid #ffeaa7; margin: 20px 0;">
            <h3 style="margin-top: 0;">Warning</h3>
            <p>${message}</p>
        </div>
    `;
}

/**
 * Create info message HTML
 * @param {string} message - Info message
 * @returns {string} HTML string for info display
 */
function createInfoHTML(message = 'Information') {
    return `
        <div class="info-display" style="background: #d1ecf1; color: #0c5460; padding: 15px; border-radius: 4px; border: 1px solid #bee5eb; margin: 20px 0;">
            <h3 style="margin-top: 0;">Information</h3>
            <p>${message}</p>
        </div>
    `;
}

/**
 * Format score with color coding
 * @param {number} score - Score value
 * @param {number} maxScore - Maximum possible score
 * @returns {string} HTML string with color-coded score
 */
function formatColoredScore(score, maxScore) {
    const percentage = Math.round((score / maxScore) * 100);
    let color = '#dc3545'; // Red

    if (percentage >= 90) color = '#28a745'; // Green
    else if (percentage >= 80) color = '#20c997'; // Teal
    else if (percentage >= 70) color = '#ffc107'; // Yellow
    else if (percentage >= 60) color = '#fd7e14'; // Orange

    return `<span style="color: ${color}; font-weight: bold;">${score}/${maxScore} (${percentage}%)</span>`;
}

/**
 * Create collapsible highlights and corrections section for UI
 * @param {number|string} essayIndex - Optional essay index for batch processing
 * @returns {string} HTML string for highlights section
 */
function createHighlightsUISection(essayIndex = '') {
    const containerId = essayIndex !== '' ? `highlights-section-${essayIndex}` : 'highlights-section';
    const contentId = essayIndex !== '' ? `highlights-content-${essayIndex}` : 'highlights-content';

    return `
        <div class="highlights-ui-section no-print" style="margin: 20px 0; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
            <div
                onclick="toggleHighlightsSection('${contentId}')"
                style="
                    background: #f8f9fa;
                    padding: 15px 20px;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #ddd;
                    user-select: none;
                "
            >
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <h3 style="margin: 0; font-size: 18px; font-weight: 600;">
                        Manage 'Highlights and Corrections' as seen on the exported PDF
                    </h3>
                    <label
                        style="display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer;"
                        onclick="event.stopPropagation();"
                    >
                        <input
                            type="checkbox"
                            id="${contentId}-remove-all"
                            class="remove-all-checkbox"
                            data-content-id="${contentId}"
                            style="cursor: pointer; width: 16px; height: 16px;"
                        />
                        <span style="color: #666;">Remove all from PDF</span>
                    </label>
                </div>
                <span id="${contentId}-arrow" style="font-size: 20px; transition: transform 0.3s;">▼</span>
            </div>
            <div
                id="${contentId}"
                style="
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease-out;
                    background: white;
                "
            >
                <div id="${contentId}-inner" style="padding: 20px;">
                    <!-- Content will be populated dynamically -->
                    <p style="color: #666; font-style: italic;">Loading highlights...</p>
                </div>
            </div>
        </div>
    `;
}

// Export functions for module usage
window.DisplayUtilsModule = {
    createSingleEssayHTML,
    createBatchEssayHTML,
    createCategoryButtons,
    createColorLegend,
    createHighlightsUISection,
    createStudentRowHTML,
    createBatchResultsHTML,
    createLoadingSpinner,
    createErrorHTML,
    createSuccessHTML,
    createWarningHTML,
    createInfoHTML,
    formatColoredScore,
    createHighlightsLegendHTML,
    setupTogglePDFListeners
};

/**
 * Toggle the highlights and corrections section
 * @param {string} contentId - ID of the content div to toggle
 */
function toggleHighlightsSection(contentId) {
    const content = document.getElementById(contentId);
    const arrow = document.getElementById(`${contentId}-arrow`);

    if (!content || !arrow) return;

    if (content.style.maxHeight === '0px' || content.style.maxHeight === '') {
        // Expand
        arrow.style.transform = 'rotate(180deg)';

        // First, populate content (if not already done)
        populateHighlightsContent(contentId);

        // Use a large fixed maxHeight value to avoid calculation issues
        // This is simpler and more reliable than trying to calculate scrollHeight during transitions
        content.style.maxHeight = '10000px';

        // Expand parent student-details after the highlights section transition completes
        // CSS transition is 0.3s (300ms), so wait for it to finish
        setTimeout(() => {
            const match = contentId.match(/highlights-content-(\d+)/);
            if (match) {
                const essayIndex = match[1];
                const studentDetails = document.getElementById(`student-details-${essayIndex}`);
                if (studentDetails && studentDetails.style.maxHeight !== '0px') {
                    studentDetails.style.maxHeight = studentDetails.scrollHeight + 2000 + 'px';
                }
            }
        }, 350);
    } else {
        // Collapse
        content.style.maxHeight = '0px';
        arrow.style.transform = 'rotate(0deg)';

        // Also recalculate parent student-details height
        const match = contentId.match(/highlights-content-(\d+)/);
        if (match) {
            const essayIndex = match[1];
            const studentDetails = document.getElementById(`student-details-${essayIndex}`);
            if (studentDetails && studentDetails.style.maxHeight !== '0px') {
                setTimeout(() => {
                    studentDetails.style.maxHeight = studentDetails.scrollHeight + 'px';
                }, 50);
            }
        }
    }
}

/**
 * Populate the highlights section with actual content
 * @param {string} contentId - ID of the content div
 */
function populateHighlightsContent(contentId) {
    const contentInner = document.getElementById(`${contentId}-inner`);
    if (!contentInner) return;

    // Check if already populated
    if (contentInner.dataset.populated === 'true') return;

    // Extract essay index from contentId if present
    const match = contentId.match(/highlights-content-(\d+)/);
    const essayIndex = match ? match[1] : null;

    // Find the essay container
    const essayContainer = essayIndex !== null
        ? document.querySelector(`.formatted-essay-content[data-essay-index="${essayIndex}"]`)
        : document.querySelector('.formatted-essay-content');

    if (!essayContainer) {
        contentInner.innerHTML = '<p style="color: #999;">No highlights found.</p>';
        return;
    }

    // Extract highlights - use broader selector to find ALL highlights
    const highlights = essayContainer.querySelectorAll('mark[data-category], mark[data-type], span[data-category], span[data-type]');

    if (highlights.length === 0) {
        contentInner.innerHTML = '<p style="color: #999;">No highlights found in the essay.</p>';
        contentInner.dataset.populated = 'true';
        return;
    }

    // Build highlights data
    const highlightsData = [];
    let highlightNumber = 1;

    highlights.forEach((mark, index) => {
        try {
            // Note: We no longer skip excluded highlights - we show them with strikethrough

            // Ensure highlight has an ID (for old highlights that don't have one)
            if (!mark.id || mark.id.trim() === '') {
                const idEssayIndex = essayIndex !== null ? essayIndex : '0';
                mark.id = `highlight-${idEssayIndex}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                console.log(`🔧 Generated ID for highlight ${index + 1}: ${mark.id}`);
            }

            const categories = (mark.dataset.category || mark.dataset.type || 'highlight').split(',').map(c => c.trim());
            const correction = mark.dataset.correction || mark.dataset.message || '';
            const explanation = mark.dataset.explanation || '';
            const notes = mark.dataset.notes || mark.title || '';
            const originalText = mark.dataset.originalText || mark.textContent || '';

            console.log(`🔍 Reading highlight ${index + 1}:`, {
                id: mark.id,
                correction_from_dataset: mark.dataset.correction,
                explanation_from_dataset: mark.dataset.explanation,
                correction_final: correction,
                explanation_final: explanation
            });

            // Validate we have at least some text
            if (!originalText || originalText.trim() === '') {
                return;
            }

            // Include ALL highlights - we'll show them all, even without corrections yet
            const highlightData = {
                number: highlightNumber,
                text: originalText.trim(),
                categories: categories,
                correction: correction.trim(),
                explanation: explanation.trim(),
                notes: notes.trim(),
                elementId: mark.id,  // Store element ID for exclude functionality
                isExcluded: mark.dataset.excludeFromPdf === 'true'  // Track excluded state
            };

            console.log(`📦 Highlight ${index + 1} data object:`, highlightData);

            highlightsData.push(highlightData);
            highlightNumber++;
        } catch (error) {
            console.error(`Error processing highlight ${index + 1}:`, error);
        }
    });

    // Generate HTML
    if (highlightsData.length === 0) {
        contentInner.innerHTML = '<p style="color: #999;">No highlights with corrections or explanations found.</p>';
    } else {
        const generatedHTML = createHighlightsLegendHTML(highlightsData);
        contentInner.innerHTML = generatedHTML;

        // Setup toggle PDF button listeners
        setupTogglePDFListeners(contentInner);

        // Setup remove-all checkbox listener
        setupRemoveAllCheckbox(contentId);
    }

    contentInner.dataset.populated = 'true';

    // Recalculate parent's maxHeight to accommodate the new content
    // Only needed if content was already expanded when we populated
    setTimeout(() => {
        const content = contentInner.parentElement;
        if (content && content.style.maxHeight && content.style.maxHeight !== '0px') {
            // Use large fixed value for reliability
            content.style.maxHeight = '10000px';

            // Also expand parent student-details div if in batch mode
            setTimeout(() => {
                const match = contentId.match(/highlights-content-(\d+)/);
                if (match) {
                    const essayIndex = match[1];
                    const studentDetails = document.getElementById(`student-details-${essayIndex}`);
                    if (studentDetails && studentDetails.style.maxHeight !== '0px') {
                        const newHeight = studentDetails.scrollHeight + 2000;
                        studentDetails.style.maxHeight = newHeight + 'px';
                    }
                }
            }, 50);
        }
    }, 100);
}

/**
 * Create highlights legend HTML (similar to PDF version)
 * @param {Array} highlightsData - Array of highlight objects
 * @returns {string} HTML string
 */
function createHighlightsLegendHTML(highlightsData) {
    if (!highlightsData.length) {
        return '';
    }

    let html = `
        <p style="margin-bottom: 20px; font-style: italic; color: #666;">
            The following numbered highlights correspond to corrections and feedback in the essay above.
        </p>
    `;

    try {
        highlightsData.forEach((highlight, idx) => {
            // Validate highlight object
            if (!highlight) {
                console.error(`Highlight ${idx + 1} is null or undefined`);
                return;
            }

            if (!highlight.categories || !Array.isArray(highlight.categories)) {
                console.error(`Highlight ${idx + 1} has invalid categories:`, highlight.categories);
                return;
            }

            // Format categories
            const categoryNames = highlight.categories.map(cat => {
                const catLower = (cat || '').toString().toLowerCase();
                return catLower.charAt(0).toUpperCase() + catLower.slice(1);
            });

            let categoryText = '';
            if (categoryNames.length === 1) {
                categoryText = categoryNames[0];
            } else if (categoryNames.length === 2) {
                categoryText = categoryNames.join(' & ') + ' Error';
            } else if (categoryNames.length > 2) {
                const lastCategory = categoryNames.pop();
                categoryText = categoryNames.join(', ') + ', & ' + lastCategory + ' Error';
            }

            // Determine CSS class for color coding
            const primaryCategory = (highlight.categories[0] || '').toString().toLowerCase();
            const borderColor = {
                'grammar': '#FF8C00',
                'vocabulary': '#00A36C',
                'spelling': '#DC143C',
                'mechanics': '#D3D3D3',
                'fluency': '#87CEEB',
                'delete': '#000000'
            }[primaryCategory] || '#667eea';

            // Entry text - escape HTML entities to prevent breaking
            const safeText = (highlight.text || '').toString()
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

            let entryText = `<span style="font-weight: bold; margin-right: 8px;">${highlight.number}.</span> You wrote "${safeText}" - ${categoryText}`;

            // Add correction and explanation
            let feedbackHTML = '';
            let hasCorrection = false;
            let hasExplanation = false;

            const correction = (highlight.correction || '').toString();
            const explanation = (highlight.explanation || '').toString();

            // Escape HTML in correction and explanation to prevent breaking
            const safeCorrection = correction
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

            const safeExplanation = explanation
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

            if (correction.trim() !== '' && !correction.includes('**no notes have been entered**')) {
                feedbackHTML += `<div style="margin-top: 8px; font-style: italic; color: #555; padding-left: 20px;"><strong>Correction:</strong> ${safeCorrection}</div>`;
                hasCorrection = true;
            }

            // Show explanation if it exists (removed check for explanation !== correction to allow duplicate values)
            if (explanation.trim() !== '' && !explanation.includes('**no notes have been entered**')) {
                feedbackHTML += `<div style="margin-top: 8px; font-style: italic; color: #555; padding-left: 20px;"><strong>Explanation:</strong> ${safeExplanation}</div>`;
                hasExplanation = true;
            }

            // If no correction or explanation, show placeholder
            if (!hasCorrection && !hasExplanation) {
                feedbackHTML += `<div style="margin-top: 8px; font-style: italic; color: #999; padding-left: 20px;"><em>Click the highlighted text to add correction and explanation</em></div>`;
            }

            console.log(`📝 Creating button for highlight ${highlight.number}:`, {
                elementId: highlight.elementId,
                hasElementId: !!highlight.elementId,
                isExcluded: highlight.isExcluded
            });

            // Determine button appearance based on excluded state
            const isExcluded = highlight.isExcluded;
            const buttonBg = isExcluded ? '#28a745' : '#dc3545';
            const buttonHoverBg = isExcluded ? '#218838' : '#c82333';
            const buttonText = isExcluded ? 'Add to PDF export' : 'Remove from PDF export';
            const entryStyle = isExcluded ? 'text-decoration: line-through; opacity: 0.6;' : '';

            const highlightHTML = `
                <div style="
                    margin: 20px 0;
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 6px;
                    border-left: 4px solid ${borderColor};
                    position: relative;
                    ${entryStyle}
                ">
                    <div style="line-height: 1.6; font-size: 14px;">
                        ${entryText}
                        ${feedbackHTML}
                    </div>
                    <button
                        class="toggle-pdf-btn"
                        data-element-id="${highlight.elementId || ''}"
                        data-excluded="${isExcluded}"
                        style="
                            position: absolute;
                            top: 10px;
                            right: 10px;
                            background: ${buttonBg};
                            color: white;
                            border: none;
                            padding: 6px 12px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 11px;
                            font-weight: 600;
                            transition: background 0.2s;
                        "
                        onmouseover="this.style.background='${buttonHoverBg}'"
                        onmouseout="this.style.background='${buttonBg}'"
                    >
                        ${buttonText}
                    </button>
                </div>
            `;

            html += highlightHTML;
        });
    } catch (error) {
        console.error('Error in createHighlightsLegendHTML forEach:', error);
        html += `<p style="color: red;">Error generating highlights: ${error.message}</p>`;
    }

    return html;
}

/**
 * Refresh highlights section content
 * @param {string} contentId - ID of the content div to refresh
 */
function refreshHighlightsSection(contentId) {
    const content = document.getElementById(contentId);
    const contentInner = document.getElementById(`${contentId}-inner`);
    if (!contentInner) {
        console.log(`refreshHighlightsSection: contentInner not found for ${contentId}`);
        return;
    }

    // Check if the section is expanded
    const isExpanded = content && (content.style.maxHeight !== '0px' && content.style.maxHeight !== '');

    console.log(`refreshHighlightsSection: ${contentId}, isExpanded: ${isExpanded}`);

    // Always reset populated flag to ensure fresh data on next open
    contentInner.dataset.populated = 'false';

    if (isExpanded) {
        console.log(`Refreshing expanded highlights section: ${contentId}`);

        // Repopulate the content
        populateHighlightsContent(contentId);

        // Re-adjust height after content changes
        setTimeout(() => {
            if (content) {
                // Use large fixed value for reliability
                content.style.maxHeight = '10000px';
            }
        }, 100);

        // Then expand parent student-details after highlights-content has updated
        setTimeout(() => {
            const match = contentId.match(/highlights-content-(\d+)/);
            if (match) {
                const essayIndex = match[1];
                const studentDetails = document.getElementById(`student-details-${essayIndex}`);
                if (studentDetails && studentDetails.style.maxHeight !== '0px') {
                    studentDetails.style.maxHeight = studentDetails.scrollHeight + 2000 + 'px';
                }
            }
        }, 350);
    } else {
        console.log(`Section ${contentId} is collapsed, will refresh when opened`);
    }
}

/**
 * Setup remove-all checkbox listener
 * @param {string} contentId - ID of the content div
 */
function setupRemoveAllCheckbox(contentId) {
    const checkbox = document.getElementById(`${contentId}-remove-all`);
    if (!checkbox) {
        console.warn(`Remove-all checkbox not found for ${contentId}`);
        return;
    }

    console.log('🔧 Setting up remove-all checkbox for:', contentId);

    checkbox.addEventListener('change', function() {
        const isChecked = this.checked;
        console.log(`📋 Remove-all checkbox ${isChecked ? 'CHECKED' : 'UNCHECKED'}`);

        // Find the content container
        const contentInner = document.getElementById(`${contentId}-inner`);
        if (!contentInner) {
            console.error('Content inner not found');
            return;
        }

        // Find all toggle buttons
        const toggleButtons = contentInner.querySelectorAll('.toggle-pdf-btn');
        console.log(`🔍 Found ${toggleButtons.length} toggle buttons to update`);

        toggleButtons.forEach(button => {
            const elementId = button.dataset.elementId;
            const highlightElement = document.getElementById(elementId);

            if (!highlightElement) {
                console.warn(`Highlight element not found: ${elementId}`);
                return;
            }

            // Set excluded state
            highlightElement.dataset.excludeFromPdf = isChecked ? 'true' : 'false';
            button.dataset.excluded = isChecked;

            // Update button appearance
            if (isChecked) {
                // Excluded state - green "Add" button
                button.style.background = '#28a745';
                button.textContent = 'Add to PDF export';
                button.onmouseover = function() { this.style.background = '#218838'; };
                button.onmouseout = function() { this.style.background = '#28a745'; };
            } else {
                // Included state - red "Remove" button
                button.style.background = '#dc3545';
                button.textContent = 'Remove from PDF export';
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

        console.log(`✅ Updated all highlights - ${isChecked ? 'excluded' : 'included'} from PDF`);
    });

    // Set initial checkbox state based on current highlights
    const contentInner = document.getElementById(`${contentId}-inner`);
    if (contentInner) {
        const toggleButtons = contentInner.querySelectorAll('.toggle-pdf-btn');
        if (toggleButtons.length > 0) {
            const allExcluded = Array.from(toggleButtons).every(btn => btn.dataset.excluded === 'true');
            checkbox.checked = allExcluded;
        }
    }
}

/**
 * Setup toggle PDF button listeners for highlights
 * @param {HTMLElement} container - Container element with toggle buttons
 */
function setupTogglePDFListeners(container) {
    console.log('🔧 setupTogglePDFListeners called with container:', container);
    const toggleButtons = container.querySelectorAll('.toggle-pdf-btn');
    console.log(`🔍 Found ${toggleButtons.length} toggle buttons`);

    toggleButtons.forEach((button, index) => {
        console.log(`🎯 Setting up listener for button ${index + 1}:`, {
            elementId: button.dataset.elementId,
            isExcluded: button.dataset.excluded,
            button: button
        });

        button.addEventListener('click', function(event) {
            console.log('🖱️ BUTTON CLICKED!', event);
            const elementId = this.dataset.elementId;
            const isCurrentlyExcluded = this.dataset.excluded === 'true';
            console.log('📋 Element ID from button:', elementId);
            console.log('📋 Currently excluded:', isCurrentlyExcluded);

            if (!elementId) {
                console.error('No element ID found for toggle button');
                return;
            }

            // Find the highlight element in the essay
            const highlightElement = document.getElementById(elementId);
            if (!highlightElement) {
                console.error(`Highlight element not found: ${elementId}`);
                alert('Error: Could not find the highlight.');
                return;
            }

            // Toggle the excluded state
            const newExcludedState = !isCurrentlyExcluded;
            highlightElement.dataset.excludeFromPdf = newExcludedState ? 'true' : 'false';

            console.log(`${newExcludedState ? '📄 Excluded' : '✅ Included'} from PDF: ${elementId}`);

            // Update button appearance
            this.dataset.excluded = newExcludedState;
            if (newExcludedState) {
                // Excluded state - green "Add" button
                this.style.background = '#28a745';
                this.style.setProperty('--hover-bg', '#218838');
                this.textContent = 'Add to PDF export';
                this.onmouseover = function() { this.style.background = '#218838'; };
                this.onmouseout = function() { this.style.background = '#28a745'; };
            } else {
                // Included state - red "Remove" button
                this.style.background = '#dc3545';
                this.style.setProperty('--hover-bg', '#c82333');
                this.textContent = 'Remove from PDF export';
                this.onmouseover = function() { this.style.background = '#c82333'; };
                this.onmouseout = function() { this.style.background = '#dc3545'; };
            }

            // Update entry styling (strikethrough)
            const entryDiv = this.closest('div[style*="margin: 20px 0"]');
            if (entryDiv) {
                if (newExcludedState) {
                    entryDiv.style.textDecoration = 'line-through';
                    entryDiv.style.opacity = '0.6';
                } else {
                    entryDiv.style.textDecoration = 'none';
                    entryDiv.style.opacity = '1';
                }
            }

            console.log(`✅ Toggled highlight PDF inclusion`);

            // Update the remove-all checkbox state
            updateRemoveAllCheckboxState(container);
        });
    });

    console.log(`✅ Setup ${toggleButtons.length} toggle PDF button listeners`);
}

/**
 * Update the remove-all checkbox state based on current toggle button states
 * @param {HTMLElement} container - Container element with toggle buttons
 */
function updateRemoveAllCheckboxState(container) {
    // Find the content ID from the container
    const contentInner = container.closest('[id$="-inner"]');
    if (!contentInner) return;

    const contentId = contentInner.id.replace('-inner', '');
    const checkbox = document.getElementById(`${contentId}-remove-all`);
    if (!checkbox) return;

    // Check if all toggle buttons are in excluded state
    const toggleButtons = container.querySelectorAll('.toggle-pdf-btn');
    const allExcluded = Array.from(toggleButtons).every(btn => btn.dataset.excluded === 'true');

    // Update checkbox without triggering the change event
    checkbox.checked = allExcluded;
}

/**
 * Setup event listeners for highlight changes
 */
function setupHighlightChangeListeners() {
    if (!window.eventBus) {
        console.warn('EventBus not available for highlight change listeners');
        return;
    }

    console.log('Setting up highlight change listeners');

    // Listen for highlight updates (when user saves edits)
    window.eventBus.on('highlight:updated', (data) => {
        console.log('Received highlight:updated event', data);

        // Refresh all highlights sections (both single and batch)
        refreshHighlightsSection('highlights-content');

        // Also refresh batch essay highlights sections (check for multiple)
        for (let i = 0; i < 50; i++) {
            const contentId = `highlights-content-${i}`;
            if (document.getElementById(contentId)) {
                refreshHighlightsSection(contentId);
            }
        }
    });

    // Listen for highlight removals
    window.eventBus.on('highlight:removed', (data) => {
        console.log('Received highlight:removed event', data);

        // Refresh all highlights sections
        refreshHighlightsSection('highlights-content');

        // Also refresh batch essay highlights sections
        for (let i = 0; i < 50; i++) {
            const contentId = `highlights-content-${i}`;
            if (document.getElementById(contentId)) {
                refreshHighlightsSection(contentId);
            }
        }
    });

    console.log('Highlight change listeners registered');
}

// Setup event listeners when module loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHighlightChangeListeners);
} else {
    setupHighlightChangeListeners();
}

// Make toggle function globally available
window.toggleHighlightsSection = toggleHighlightsSection;