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
        <div style="margin-top: 25px; text-align: center;">
            <button onclick="downloadIndividualEssay(${index})" style="background: #007bff; color: white; border: none; padding: 20px 32px; border-radius: 8px; font-size: 20px; cursor: pointer; font-weight: 600;">
                Download PDF
            </button>
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
    const hoverColor = essay.success ? '#e9ecef' : '#fed7d7';
    const textColor = essay.success ? '#333' : '#721c24';

    return `
        <div class="student-row" style="border: 2px solid #ddd; margin: 16px 0; border-radius: 8px; overflow: hidden;">
            <div class="student-header" onclick="toggleStudentDetails(${index})" style="
                padding: 24px 30px;
                background: ${backgroundColor};
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
                transition: background-color 0.2s;
                font-size: 22px;
                font-weight: 500;
                min-height: 60px;
            " onmouseover="this.style.backgroundColor='${hoverColor}'"
               onmouseout="this.style.backgroundColor='${backgroundColor}'">
                <div style="display: flex; align-items: center; gap: 15px; flex: 1; min-width: 0;">
                    <span style="font-size: 28px;">${statusIcon}</span>
                    <span style="font-weight: 600; color: ${textColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 24px;">${essay.studentName}</span>
                    ${!essay.success ? '<span style="color: #721c24; font-size: 20px; white-space: nowrap; font-weight: 500;">(Failed)</span>' : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 20px; flex-shrink: 0;">
                    <label style="display: flex; align-items: center; gap: 10px; margin: 0; cursor: pointer; pointer-events: auto;" onclick="event.stopPropagation();">
                        <input type="checkbox" class="mark-complete-checkbox" data-student-index="${index}" style="margin: 0; transform: scale(2);">
                        <span style="font-size: 20px; color: #666; white-space: nowrap; font-weight: 600;">Mark Complete</span>
                    </label>
                    ${essay.success ? `<button onclick="event.stopPropagation(); downloadIndividualEssay(${index})" style="background: #007bff; color: white; border: none; padding: 16px 24px; border-radius: 8px; font-size: 18px; cursor: pointer; white-space: nowrap; pointer-events: auto; font-weight: 600;">Download</button>` : ''}
                </div>
            </div>
            <div id="student-details-${index}" class="student-details" style="
                max-height: 0;
                overflow: hidden;
                border-top: 1px solid #ddd;
                transition: max-height 0.3s ease-in-out;
            ">
                ${essay.success ?
                    `<div id="batch-essay-${index}" style="padding: 15px;">Loading formatted result...</div>` :
                    `<div style="padding: 15px; color: #721c24;">Error: ${essay.error}</div>`
                }
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

// Export functions for module usage
window.DisplayUtilsModule = {
    createSingleEssayHTML,
    createBatchEssayHTML,
    createCategoryButtons,
    createColorLegend,
    createStudentRowHTML,
    createBatchResultsHTML,
    createLoadingSpinner,
    createErrorHTML,
    createSuccessHTML,
    createWarningHTML,
    createInfoHTML,
    formatColoredScore
};