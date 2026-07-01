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
            <div id="categoryBar-${index}" style="padding: 10px 10px 6px 10px; background: #f8f9fa; border-bottom: 1px solid #ddd; border-radius: 4px 4px 0 0;">
                <div style="margin-bottom: 10px; font-weight: bold; font-size: 14px;">Select category then highlight text, or highlight text then select category:</div>
                <div id="categoryButtons-${index}" style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${createCategoryButtons(index)}
                    <button id="clearSelectionBtn-${index}" onclick="clearSelection(${index})" style="background: #f5f5f5; color: #666; border: 2px solid #ccc; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-left: 10px;">Clear Selection</button>
                </div>
                <div id="selectionStatus-${index}" style="margin-top: 2px; font-size: 12px; color: #666; min-height: 10px;"></div>
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

        <div style="margin-top: 20px; text-align: center; display: flex; justify-content: center; gap: 10px;">
            <button onclick="downloadIndividualEssay(${index})" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-size: 15px; cursor: pointer; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s;" onmouseover="this.style.background='#0056b3'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.15)'" onmouseout="this.style.background='#007bff'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.1)'">Export to PDF</button>
            <button onclick="saveEssayToAccount(this, ${index})" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-size: 15px; cursor: pointer; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s;" onmouseover="this.style.background='#218838'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.15)'" onmouseout="this.style.background='#28a745'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.1)'">Save Essay</button>
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

    // Fallback implementation — generated from the single source of truth.
    const dataAttr = essayIndex ? ` data-essay-index="${essayIndex}"` : '';

    return window.CATEGORIES.getManualCategories().map(category => {
        const style = window.CATEGORIES.getCategoryStyle(category.id);
        const isFill = style.background !== 'transparent';
        const bgColor = isFill ? style.background : 'transparent';
        const textColor = isFill ? 'black' : style.color;
        const decoration = style.strikethrough ? 'text-decoration: line-through;' : '';
        return `<button class="category-btn" data-category="${category.id}"${dataAttr} style="background: ${bgColor}; color: ${textColor}; border: 2px solid ${category.color}; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: all 0.2s; ${decoration}">${category.shortName || category.name}</button>`;
    }).join('\n        ');
}

/**
 * Create color legend HTML
 * @returns {string} HTML string for color legend
 */
function createColorLegend() {
    // Generated from the single source of truth (window.CATEGORIES).
    const swatches = window.CATEGORIES.getManualCategories().map((category, i) => {
        const style = window.CATEGORIES.getCategoryStyle(category.id);
        const isFill = style.background !== 'transparent';
        const marginLeft = i === 0 ? '10px' : '15px';
        const decoration = style.strikethrough ? ' text-decoration: line-through;' : '';
        const styleAttr = isFill
            ? `background: ${style.background}; color: #000; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: ${marginLeft};${decoration}`
            : `color: ${style.color}; font-weight: bold; margin-left: ${marginLeft}; background: transparent;${decoration}`;
        return `<mark class="legend-${category.id}" data-category="${category.id}" style="${styleAttr}">${category.name}</mark>`;
    }).join('\n            ');

    return `
        <div class="color-legend" style="padding: 10px 15px; border-top: 1px solid #ddd; background: #f9f9f9; font-size: 12px; user-select: none; pointer-events: none;">
            <strong>Highlight Meanings:</strong>
            ${swatches}
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
    const essayId = essay.essayId || '';
    // Retry args carry the stable essayId so a retry re-grades the right student.
    const retryArgs = essayId ? `${index}, '${essayId}'` : `${index}`;

    return `
        <div class="student-row" id="student-row-${index}" data-essay-id="${essayId}" data-student-name="${(essay.studentName || '').replace(/"/g, '&quot;')}" style="border: 2px solid #ddd; margin: 10px 0; border-radius: 6px; overflow: hidden;">
            <!-- Student Name Header (clickable to expand grade details) -->
            <div class="student-header-clickable" onclick="toggleTab('grade-details-${index}', ${index})" style="
                padding: 12px 18px;
                background: ${backgroundColor};
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
            " onmouseover="this.style.backgroundColor='${essay.success ? '#e9ecef' : '#ffe5e5'}'"
               onmouseout="this.style.backgroundColor='${backgroundColor}'">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                    <span id="grade-details-${index}-arrow" style="font-size: 14px; transition: transform 0.3s; display: inline-block;">▼</span>
                    <span style="font-size: 18px;">${statusIcon}</span>
                    <span style="font-weight: 600; color: ${textColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 16px;">${essay.studentName}</span>
                    ${!essay.success ? `
                    <span id="student-status-${index}" class="student-status" style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #721c24; font-size: 14px; white-space: nowrap; font-weight: 500;">(Did not return)</span>
                        <button onclick="event.stopPropagation(); window.BatchProcessingModule.retryEssay(${retryArgs})"
                                style="padding: 4px 10px; font-size: 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;"
                                onmouseover="this.style.background='#0056b3'"
                                onmouseout="this.style.background='#007bff'">
                            Retry
                        </button>
                    </span>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                    <label style="display: flex; align-items: center; gap: 6px; margin: 0; cursor: pointer;" onclick="event.stopPropagation();">
                        <input type="checkbox" class="mark-complete-checkbox" data-student-index="${index}" style="margin: 0; transform: scale(1.3);">
                        <span style="font-size: 14px; color: #666; white-space: nowrap; font-weight: 600;">Mark Complete</span>
                    </label>
                    ${essay.success ? `<button onclick="event.stopPropagation(); downloadIndividualEssay(${index})" style="background: #007bff; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-size: 14px; cursor: pointer; white-space: nowrap; font-weight: 600;">Download</button>` : ''}
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
                <div id="batch-essay-${index}" data-essay-id="${essayId}" style="padding: 15px;">Loading formatted result...</div>
            </div>

            <!-- Highlights Management Tab: single full-width clickable title bar.
                 The "Remove all from PDF" control now lives INSIDE the dropdown
                 body (top of the highlights list) so teachers always open it and
                 watch the marks get struck through. No carrot, hover-fills. -->
            <div class="tab-header" style="
                background: #ffffff;
                border-bottom: 1px solid #ddd;
                user-select: none;
            ">
                <div onclick="toggleTab('highlights-tab-${index}', ${index})" style="
                    padding: 12px 18px;
                    min-height: 44px;
                    box-sizing: border-box;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    transition: background-color 0.2s;
                " onmouseover="this.style.backgroundColor='#e9ecef'"
                   onmouseout="this.style.backgroundColor='#ffffff'">
                <span style="font-weight: 600; font-size: 13px;">Manage 'Highlights and Corrections' as seen on the exported PDF</span>
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
            ` : `
            <!-- Failed / never-returned essay: clear, student-bound placeholder
                 with a retry that re-grades this exact student (by essayId). -->
            <div id="grade-details-${index}" class="tab-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; background: white;">
                <div id="batch-essay-${index}" data-essay-id="${essayId}" style="padding: 15px;">
                    <div style="padding: 14px; border: 1px dashed #dc3545; border-radius: 6px; background: #fff5f5; color: #842029; font-size: 14px; line-height: 1.5;">
                        <strong>This essay did not return.</strong> We're sorry — nothing was graded for this student.
                        ${essay.error ? `<div style="font-size: 12px; color: #a06; margin-top: 6px;">${essay.error}</div>` : ''}
                        <div style="margin-top: 10px;">
                            <button onclick="window.BatchProcessingModule.retryEssay(${retryArgs})"
                                    style="padding: 6px 14px; font-size: 13px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
                                Retry this essay
                            </button>
                        </div>
                    </div>
                </div>
            </div>
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
            <h2 style="font-size: 20px; margin-bottom: 12px;">Grading Results (${batchResult.totalEssays} essays)</h2>
            <div style="background: #fff3cd; border: 2px solid #ffc107; padding: 12px; border-radius: 6px; margin: 12px 0; color: #856404; font-size: 14px; line-height: 1.4; font-weight: 500;">
                <strong style="font-size: 15px;">⚠️</strong> The AI will make mistakes. Please review all essays and make any necessary manual edits.
            </div>
            <div class="batch-summary" style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin: 10px 0; font-size: 14px;">
                <p style="margin: 0;"><strong>Summary:</strong> ${successCount} successful, ${failureCount} failed</p>
            </div>
            <div class="compact-student-list" style="margin: 12px 0;">
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

// Export functions for module usage
window.DisplayUtilsModule = {
    createBatchEssayHTML,
    createCategoryButtons,
    createColorLegend,
    createStudentRowHTML,
    createBatchResultsHTML,
    createLoadingSpinner,
    createErrorHTML,
    createHighlightsLegendHTML,
    setupTogglePDFListeners,
    setupRemoveAllCheckbox,
    applyRemoveAllStateToMarks,
    syncAllRemoveAllStateToMarks
};
// Global alias so the PDF exporter can sync exclude-state onto marks right
// before export, independent of whether each highlights dropdown was opened.
window.syncAllRemoveAllStateToMarks = syncAllRemoveAllStateToMarks;

/**
 * Populate the highlights section with actual content
 * @param {string} contentId - ID of the content div
 */
function populateHighlightsContent(contentId) {
    // Tab-scope the -inner lookup: contentId is index-bearing and not unique
    // across tabs (inactive panes stay in the DOM), so a bare getElementById
    // could populate the WRONG tab's container (its essay lookup below is
    // already active-tab-scoped, so a mismatch would build one tab's dropdown
    // into another's). [id="…"] attribute selector is robust under duplicate ids.
    const contentInner = window.TabStore
        ? window.TabStore.activeQuery(`[id="${contentId}-inner"]`)
        : document.getElementById(`${contentId}-inner`);
    if (!contentInner) return;

    // Check if already populated
    if (contentInner.dataset.populated === 'true') return;

    // Extract essay index from contentId if present
    const match = contentId.match(/highlights-content-(\d+)/);
    const essayIndex = match ? match[1] : null;

    // Find the essay container — TAB-SCOPED. An essay index is not unique across
    // tabs, so a bare document.querySelector could grab another tab's same-index
    // essay (with remove-all on / marks struck out) and build this dropdown from
    // it. Scope to the active tab (this populate runs for the active tab's render).
    const scopedQuery = (selector) => window.TabStore
        ? window.TabStore.activeQuery(selector)
        : document.querySelector(selector);
    const essayContainer = essayIndex !== null
        ? scopedQuery(`.formatted-essay-content[data-essay-index="${essayIndex}"]`)
        : scopedQuery('.formatted-essay-content');

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

    // Build highlights data (deduplicate grouped highlights)
    const highlightsData = [];
    let highlightNumber = 1;
    const seenGroups = new Set();

    highlights.forEach((mark, index) => {
        try {
            // Skip subsequent marks from the same highlight group
            const groupId = mark.dataset.highlightGroup;
            if (groupId) {
                if (seenGroups.has(groupId)) return;
                seenGroups.add(groupId);
            }

            // Note: We no longer skip excluded highlights - we show them with strikethrough

            // Ensure highlight has an ID (for old highlights that don't have one)
            if (!mark.id || mark.id.trim() === '') {
                const idEssayIndex = essayIndex !== null ? essayIndex : '0';
                mark.id = `highlight-${idEssayIndex}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            }

            const categories = (mark.dataset.category || mark.dataset.type || 'highlight').split(',').map(c => c.trim());
            const correction = mark.dataset.correction || mark.dataset.message || '';
            const explanation = mark.dataset.explanation || '';
            const notes = mark.dataset.notes || mark.title || '';
            const originalText = mark.dataset.originalText || mark.textContent || '';

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
        const generatedHTML = createHighlightsLegendHTML(highlightsData, contentId);
        contentInner.innerHTML = generatedHTML;

        // Setup toggle PDF button listeners
        setupTogglePDFListeners(contentInner);

        // Setup remove-all checkbox listener (handles applying saved state internally)
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
                    const studentDetails = window.TabStore
                        ? window.TabStore.activeQuery(`#student-details-${essayIndex}`)
                        : document.getElementById(`student-details-${essayIndex}`);
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
/**
 * Build the localStorage key for an essay's "remove all from PDF" state.
 *
 * THE BUG THIS FIXES: the key used to be `removeAllFromPDF_${contentId}` where
 * contentId is index-based (`highlights-tab-content-0`, …). The index RESETS
 * per tab, so tab 1 essay 0 and tab 2 essay 0 shared one key — checking
 * remove-all in one tab made other tabs' essay 0 render pre-checked (and it
 * leaked across page loads too). Scoping the key by tabId makes it unique per
 * essay-per-tab. ALL reads and writes MUST go through this single helper so a
 * read and a write can never build the key differently.
 *
 * @param {string} contentId - e.g. "highlights-tab-content-0" / "highlights-content-0"
 * @param {string} [tabId] - the owning tab; defaults to the active tab (correct
 *   for render/setup sites, which run for the active tab). Restore MUST pass the
 *   explicit tab being restored, since the active tab flips during multi-tab restore.
 * @returns {string}
 */
function removeAllStorageKey(contentId, tabId) {
    const tid = tabId
        || (window.TabStore && window.TabStore.activeId && window.TabStore.activeId())
        || '';
    return `removeAllFromPDF_${tid}_${contentId}`;
}
// Cross-file: grading-display-main.js, auto-save.js, batch-processing.js, and
// editing-functions.js all build this key too — they call this same helper.
window.removeAllStorageKey = removeAllStorageKey;

/**
 * Map a highlights contentId to its remove-all checkbox element id.
 * The batch family drops the "-content" segment:
 *   highlights-tab-content-N  → highlights-tab-N-remove-all
 *   highlights-content-N      → highlights-content-N-remove-all
 * Single source of truth — this derivation was duplicated across 4 sites and
 * MUST stay consistent (a drift here re-creates the class of remove-all bug).
 * @param {string} contentId
 * @returns {string}
 */
function removeAllCheckboxId(contentId) {
    const tabMatch = (contentId || '').match(/^highlights-tab-content-(\d+)$/);
    return tabMatch ? `highlights-tab-${tabMatch[1]}-remove-all` : `${contentId}-remove-all`;
}
window.removeAllCheckboxId = removeAllCheckboxId;

/**
 * One-time migration: delete the OLD index-only remove-all keys
 * (`removeAllFromPDF_highlights-…`, no tabId segment) that the pre-fix code
 * wrote. They're now orphaned (nothing reads them) and could otherwise leave a
 * stale pre-check around. New keys are `removeAllFromPDF_${tabId}_highlights-…`,
 * so the `_highlights-` anchor below matches ONLY old keys. Guarded to run once.
 */
function migrateRemoveAllKeysOnce() {
    try {
        if (localStorage.getItem('removeAllKeyMigrationV1') === 'done') return;
        Object.keys(localStorage)
            .filter(k => /^removeAllFromPDF_highlights-/.test(k))
            .forEach(k => localStorage.removeItem(k));
        localStorage.setItem('removeAllKeyMigrationV1', 'done');
    } catch (e) {
        // localStorage unavailable / quota — non-fatal; skip the migration.
    }
}
migrateRemoveAllKeysOnce();

/**
 * Build the "Remove all from PDF" checkbox row shown at the top of a highlights
 * dropdown. Keeps the exact id / class / data-content-id the rest of the app
 * wires against. Initial checked state comes from localStorage so it paints
 * correctly the moment the dropdown opens.
 * @param {string} contentId - e.g. "highlights-tab-content-0" or "highlights-content-0"
 * @returns {string} HTML string
 */
function createRemoveAllRowHTML(contentId) {
    const checkboxId = removeAllCheckboxId(contentId);
    const isChecked = localStorage.getItem(removeAllStorageKey(contentId)) === 'true';

    return `
        <label style="
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 16px;
            padding: 8px 10px;
            background: #f8f9fa;
            border: 1px solid #e3e3e3;
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
        ">
            <input type="checkbox" id="${checkboxId}" class="remove-all-checkbox"
                   data-content-id="${contentId}"
                   style="cursor: pointer; width: 14px; height: 14px; margin: 0;"
                   ${isChecked ? 'checked' : ''}>
            <span style="font-weight: 500; color: #555;">Remove all highlights &amp; corrections from the exported PDF</span>
        </label>
    `;
}

function createHighlightsLegendHTML(highlightsData, contentId = '') {
    if (!highlightsData.length) {
        return '';
    }

    // "Remove all from PDF" lives in the dropdown body (not the header), so
    // teachers who use it always open the list and watch every highlight get
    // struck through — visual confirmation it worked. It sits just below the
    // intro line, above the first highlight. The checkbox keeps its original
    // id/class/data-content-id so all existing wiring (setupRemoveAllCheckbox*,
    // the delegated change listener, and syncAllRemoveAllStateToMarks) keeps
    // working unchanged. Initial checked state is read from localStorage here so
    // it's correct on first paint.
    const removeAllRow = contentId
        ? createRemoveAllRowHTML(contentId)
        : '';

    let html = `
        <p style="margin-bottom: 16px; color: #444; font-size: 15px;">
            The following numbered highlights correspond to corrections and feedback in the essay above.
        </p>
        ${removeAllRow}
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

            // Format categories using the single source of truth (display names).
            const categoryNames = highlight.categories.map(cat =>
                window.CATEGORIES.getCategoryName(cat)
            );

            let categoryText = '';
            if (categoryNames.length === 1) {
                categoryText = categoryNames[0];
            } else if (categoryNames.length === 2) {
                categoryText = categoryNames.join(' & ') + ' Error';
            } else if (categoryNames.length > 2) {
                const lastCategory = categoryNames.pop();
                categoryText = categoryNames.join(', ') + ', & ' + lastCategory + ' Error';
            }

            // Color-coding accent: use the primary category's swatch color.
            const primaryCategory = (highlight.categories[0] || '').toString().toLowerCase();
            const primaryCat = window.CATEGORIES.getCategory(primaryCategory);
            const borderColor = primaryCat ? primaryCat.color : '#667eea';

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
                .replace(/'/g, '&#039;')
                .replace(/\n/g, '<br>');

            const safeExplanation = explanation
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;')
                .replace(/\n/g, '<br>');

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

            // Determine button appearance based on excluded state
            const isExcluded = highlight.isExcluded;
            const buttonBg = isExcluded ? '#28a745' : '#dc3545';
            const buttonHoverBg = isExcluded ? '#218838' : '#c82333';
            const buttonText = isExcluded ? '+' : '-';
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
    // Tab-scope these lookups: contentId is index-bearing and not unique across
    // tabs (inactive panes stay in the DOM), so a bare getElementById would
    // refresh the WRONG tab's section. Scope to the active tab via an [id="…"]
    // attribute selector (robust under duplicate ids across panes).
    const content = window.TabStore
        ? window.TabStore.activeQuery(`[id="${contentId}"]`)
        : document.getElementById(contentId);
    const contentInner = window.TabStore
        ? window.TabStore.activeQuery(`[id="${contentId}-inner"]`)
        : document.getElementById(`${contentId}-inner`);
    if (!contentInner) {
        return;
    }

    // Check if the section is expanded
    const isExpanded = content && (content.style.maxHeight !== '0px' && content.style.maxHeight !== '');

    // Always reset populated flag to ensure fresh data on next open
    contentInner.dataset.populated = 'false';

    if (isExpanded) {

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
                const studentDetails = window.TabStore
                    ? window.TabStore.activeQuery(`#student-details-${essayIndex}`)
                    : document.getElementById(`student-details-${essayIndex}`);
                if (studentDetails && studentDetails.style.maxHeight !== '0px') {
                    studentDetails.style.maxHeight = studentDetails.scrollHeight + 2000 + 'px';
                }
            }
        }, 350);
    }
}

/**
 * Apply the remove-all teacher-note transform for the essay owning a given
 * remove-all checkbox. Resolves the essay's .teacher-notes block and adds/
 * subtracts the closing sentence to match the checkbox state. Shared by all the
 * remove-all change handlers. Guarded — no-op if the editing module or note
 * block isn't available.
 * @param {HTMLElement} checkbox - the toggled remove-all checkbox
 */
function applyRemoveAllToTeacherNoteFor(checkbox) {
    try {
        const mod = window.EditingFunctionsModule;
        if (!mod || !mod.applyRemoveAllToTeacherNote || !mod.findTeacherNotesBlockForEssay) return;
        const notesBlock = mod.findTeacherNotesBlockForEssay(checkbox);
        if (notesBlock) mod.applyRemoveAllToTeacherNote(notesBlock, !!checkbox.checked);
    } catch (e) {
        console.warn('[DisplayUtils] teacher-note remove-all transform skipped:', e && e.message);
    }
}
// Shared by the other remove-all change handlers in grading-display-main.js and
// auto-save.js so the teacher-note transform is wired uniformly.
window.applyRemoveAllToTeacherNoteFor = applyRemoveAllToTeacherNoteFor;

/**
 * Setup remove-all checkbox listener
 * @param {string} contentId - ID of the content div
 */
function setupRemoveAllCheckbox(contentId, checkboxEl) {
    // Resolve the checkbox TAB-SCOPED. `${contentId}-remove-all` is index-based
    // and repeats across panes (inactive panes stay in the DOM), so a bare
    // getElementById returns the FIRST in document order — which wires this
    // setup onto the WRONG tab's checkbox when the active tab isn't first.
    // That was the live remove-all cross-tab bleed: the toggle landed on
    // another tab's marks.
    //
    // Callers that already hold the exact checkbox (the multi-tab RESTORE path,
    // which resolves it via paneForTab(restoringTab) — NOT the active tab, since
    // the active tab flips as restore iterates behind a 250ms timeout) pass it
    // in as checkboxEl. Live-render callers omit it, and we resolve the ACTIVE
    // pane's checkbox via the [id="…"] attribute selector (robust under
    // duplicate ids in browsers + jsdom).
    const checkbox = checkboxEl || (window.TabStore
        ? window.TabStore.activeQuery(`[id="${contentId}-remove-all"]`)
        : document.getElementById(`${contentId}-remove-all`));
    if (!checkbox) {
        console.warn(`Remove-all checkbox not found for ${contentId}`);
        return;
    }

    // Scope every downstream lookup to the checkbox's OWN pane. The inner
    // container id (`${contentId}-inner`) is also index-based and collides
    // across tabs, so resolving it — and the marks it enumerates — must be
    // pinned to this checkbox's pane, never document-wide. Falls back to the
    // document when there's no tab pane (non-tabbed contexts).
    const ownPane = checkbox.closest('.tab-pane');
    const queryInPane = (id) => ownPane
        ? ownPane.querySelector(`[id="${id}"]`)
        : document.getElementById(id);

    // Prevent multiple setups on the same checkbox
    if (checkbox.dataset.setupComplete === 'true') {
        return;
    }

    // CAPTURE the checkbox state IMMEDIATELY before any other operations
    const currentCheckboxState = checkbox.checked;
    const storageKey = removeAllStorageKey(contentId);
    const savedState = localStorage.getItem(storageKey);

    let isChecked;

    // Resolve the authoritative state. Important guard: NEVER downgrade a box
    // the user currently has CHECKED unless localStorage EXPLICITLY says 'false'.
    // Previously, populating the dropdown (which runs this setup) could read
    // savedState as null/stale for the just-checked first essay and force the
    // checkbox back to unchecked — the rare "checked, then unchecked itself when
    // I opened the dropdown" blip. Treat a live-checked box as the user's intent
    // and persist it, so an ambiguous/missing saved value can't override it.
    if (currentCheckboxState && savedState !== 'false') {
        // User has it checked and storage doesn't explicitly say otherwise — keep it.
        isChecked = true;
        checkbox.checked = true;
        localStorage.setItem(storageKey, 'true');
    } else if (savedState !== null) {
        // Not currently checked (or storage explicitly says false): trust storage.
        isChecked = savedState === 'true';
        checkbox.checked = isChecked;
    } else {
        // No saved state and not checked → unchecked.
        isChecked = false;
        checkbox.checked = false;
    }

    // Reflect the determined state in the teacher note (idempotent: only changes
    // the note if the sentence needs adding/removing), so a restored remove-all
    // session shows the correct note without a manual toggle.
    applyRemoveAllToTeacherNoteFor(checkbox);

    // Apply the determined state to all highlights
    if (isChecked) {
        const contentInner = queryInPane(`${contentId}-inner`);
        if (contentInner) {
            const toggleButtons = contentInner.querySelectorAll('.toggle-pdf-btn');

            toggleButtons.forEach(button => {
                const elementId = button.dataset.elementId;
                const highlightElement = queryInPane(elementId);

                if (highlightElement) {
                    // Set excluded state
                    highlightElement.dataset.excludeFromPdf = 'true';
                    button.dataset.excluded = 'true';

                    // Update button appearance for excluded state
                    button.style.background = '#28a745';
                    button.textContent = '+';
                    button.onmouseover = function() { this.style.background = '#218838'; };
                    button.onmouseout = function() { this.style.background = '#28a745'; };

                    // Update entry styling
                    const entryDiv = button.closest('div[style*="margin: 20px 0"]');
                    if (entryDiv) {
                        entryDiv.style.textDecoration = 'line-through';
                        entryDiv.style.opacity = '0.6';
                    }
                }
            });
        }
    }

    checkbox.addEventListener('change', function() {
        const isChecked = this.checked;

        // Save state to localStorage (tab-scoped key via the shared helper)
        localStorage.setItem(removeAllStorageKey(contentId), isChecked.toString());

        // (The teacher-note add/subtract is driven by the document-level
        // delegated remove-all listener below, so it fires for every checkbox
        // regardless of which per-element handler is attached.)

        // Find the content container — scoped to this checkbox's OWN pane, so a
        // live toggle can only ever affect its own tab's highlights (the id is
        // index-based and collides across panes).
        const contentInner = queryInPane(`${contentId}-inner`);
        if (!contentInner) {
            return;
        }

        // Find all toggle buttons
        const toggleButtons = contentInner.querySelectorAll('.toggle-pdf-btn');

        toggleButtons.forEach(button => {
            const elementId = button.dataset.elementId;
            const highlightElement = queryInPane(elementId);

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
                button.textContent = '+';
                button.onmouseover = function() { this.style.background = '#218838'; };
                button.onmouseout = function() { this.style.background = '#28a745'; };
            } else {
                // Included state - red "Remove" button
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
}

/**
 * Apply the durable "remove all from PDF" state DIRECTLY onto an essay's
 * highlight marks, independent of the error-list dropdown being rendered.
 *
 * THE BUG THIS FIXES: previously the only code that wrote `excludeFromPdf`
 * onto the marks (setupRemoveAllCheckbox) iterated the `.toggle-pdf-btn`
 * buttons, which only exist AFTER the highlights dropdown is lazily populated
 * (populateHighlightsContent). So if a teacher checked "remove all" (or it was
 * restored from localStorage) but exported BEFORE ever opening the dropdown,
 * the marks were never tagged and the PDF included everything. It "only worked
 * after opening the dropdown" because opening it populated the buttons.
 *
 * This reads the durable localStorage state and tags the essay's marks straight
 * from the essay container — no dropdown/button dependency — so the exporter
 * (which reads mark.dataset.excludeFromPdf) sees correct state every time.
 *
 * @param {number|string} essayIndex - the essay's index (matches
 *   .formatted-essay-content[data-essay-index] and the contentId suffix).
 *   Pass '' for the single-essay (non-batch) case.
 */
function applyRemoveAllStateToMarks(essayIndex, tabId) {
    try {
        const idx = (essayIndex === '' || essayIndex === null || essayIndex === undefined)
            ? '' : String(essayIndex);

        // TAB SCOPING (critical): an essay index (0, 1, …) is NOT unique across
        // tabs — index 0 exists in every tab's pane. Without scoping, the lookups
        // below would grab whichever tab's checkbox/container matched FIRST, so a
        // remove-all checked in tab A would tag a same-index essay's marks in tab
        // B (struck-out highlights + blank PDF). Scope every lookup to tabId. When
        // no tabId is given (single-essay / no TabStore), fall back to document.
        const scopedQuery = (selector) => {
            if (tabId && window.TabStore) return window.TabStore.queryInTab(tabId, selector);
            return document.querySelector(selector);
        };

        // The two contentId families that carry a remove-all checkbox for this
        // essay: the grade-details section and the highlights tab. Either being
        // checked means "remove all" for this essay.
        const contentIds = idx === ''
            ? ['highlights-content']
            : [`highlights-content-${idx}`, `highlights-tab-content-${idx}`];

        // Detect remove-all from EITHER the durable localStorage state (tab-scoped
        // key) OR the live checkbox (covers a fresh-browser restore where
        // localStorage is empty but restoreTabDOM re-checked the box). The
        // tab-variant checkbox id differs from its contentId
        // (highlights-tab-content-N → highlights-tab-N-remove-all).
        let removeAll = false;
        for (const cid of contentIds) {
            if (localStorage.getItem(removeAllStorageKey(cid, tabId)) === 'true') {
                removeAll = true;
                break;
            }
            const cb = scopedQuery(`#${removeAllCheckboxId(cid)}`);
            if (cb && cb.checked) {
                removeAll = true;
                break;
            }
        }
        if (!removeAll) return; // nothing to apply; leave per-mark state as-is

        // Find the essay's marks directly (same selector populateHighlightsContent
        // uses), NOT via toggle buttons — scoped to this tab's pane.
        const essayContainer = idx === ''
            ? scopedQuery('.formatted-essay-content')
            : scopedQuery(`.formatted-essay-content[data-essay-index="${idx}"]`);
        if (!essayContainer) return;

        const marks = essayContainer.querySelectorAll(
            'mark[data-category], mark[data-type], span[data-category], span[data-type]'
        );
        marks.forEach(mark => { mark.dataset.excludeFromPdf = 'true'; });
    } catch (e) {
        console.warn('[DisplayUtils] applyRemoveAllStateToMarks skipped:', e && e.message);
    }
}

/**
 * Sync the "remove all from PDF" state onto the marks of EVERY rendered essay.
 * Called right before a PDF export so the exporter never depends on whether the
 * teacher happened to open each essay's highlights dropdown first. Cheap and
 * idempotent; safe to call on every export.
 */
function syncAllRemoveAllStateToMarks() {
    // Iterate PER TAB so each essay's remove-all state is read and applied within
    // its OWN tab — never leaking a tab's state onto a same-index essay in another
    // tab (the cross-tab "struck-out highlights / blank PDF" bug).
    if (window.TabStore && typeof window.TabStore.all === 'function') {
        window.TabStore.all().forEach(tab => {
            const tabId = tab && tab.id;
            if (!tabId) return;
            // Single-essay (non-batch) container in this tab, if any.
            if (window.TabStore.queryInTab(tabId, '.formatted-essay-content:not([data-essay-index])')) {
                applyRemoveAllStateToMarks('', tabId);
            }
            // Batch essays in this tab.
            window.TabStore.queryAllInTab(tabId, '.formatted-essay-content[data-essay-index]')
                .forEach(el => {
                    const idx = el.getAttribute('data-essay-index');
                    if (idx !== null && idx !== '') applyRemoveAllStateToMarks(idx, tabId);
                });
        });
        return;
    }
    // Fallback (no TabStore): document-wide, single-tab behavior.
    applyRemoveAllStateToMarks('');
    document.querySelectorAll('.formatted-essay-content[data-essay-index]').forEach(el => {
        const idx = el.getAttribute('data-essay-index');
        if (idx !== null && idx !== '') applyRemoveAllStateToMarks(idx);
    });
}

/**
 * Setup toggle PDF button listeners for highlights
 * @param {HTMLElement} container - Container element with toggle buttons
 */
function setupTogglePDFListeners(container) {
    const toggleButtons = container.querySelectorAll('.toggle-pdf-btn');

    toggleButtons.forEach((button) => {
        button.addEventListener('click', function(event) {
            const elementId = this.dataset.elementId;
            const isCurrentlyExcluded = this.dataset.excluded === 'true';

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

            // Update button appearance
            this.dataset.excluded = newExcludedState;
            if (newExcludedState) {
                // Excluded state - green "Add" button
                this.style.background = '#28a745';
                this.style.setProperty('--hover-bg', '#218838');
                this.textContent = '+';
                this.onmouseover = function() { this.style.background = '#218838'; };
                this.onmouseout = function() { this.style.background = '#28a745'; };
            } else {
                // Included state - red "Remove" button
                this.style.background = '#dc3545';
                this.style.setProperty('--hover-bg', '#c82333');
                this.textContent = '-';
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

            // Update the remove-all checkbox state
            updateRemoveAllCheckboxState(container);
        });
    });
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
 * Setup toggle PDF button listeners for category notes (auto-filled rationales)
 * Called after grading results are displayed
 */
/**
 * Toggle whether a category's note is included in the PDF. Self-contained: reads
 * and flips the button's own state and updates the sibling textarea styling.
 * Called by the document-level delegated click handler below (and previously by
 * per-button listeners — see the note on setupCategoryNoteToggleListeners).
 * @param {HTMLElement} button - the clicked .toggle-note-pdf-btn
 */
function applyCategoryNoteToggle(button) {
    const isCurrentlyExcluded = button.dataset.excluded === 'true';
    const newExcludedState = !isCurrentlyExcluded;

    // Find the parent category-feedback div
    const categoryDiv = button.closest('.category-feedback');
    if (categoryDiv) {
        categoryDiv.dataset.noteExcludeFromPdf = newExcludedState ? 'true' : 'false';
    }

    // Find the textarea for this category
    const textarea = categoryDiv?.querySelector('.editable-feedback');

    // Update button appearance
    button.dataset.excluded = newExcludedState;
    if (newExcludedState) {
        // Excluded state - green "Add" button, grayed textarea
        button.style.background = '#28a745';
        button.textContent = '+';
        if (textarea) {
            textarea.style.textDecoration = 'line-through';
            textarea.style.opacity = '0.6';
        }
    } else {
        // Included state - red "Remove" button, normal textarea
        button.style.background = '#dc3545';
        button.textContent = '-';
        if (textarea) {
            textarea.style.textDecoration = 'none';
            textarea.style.opacity = '1';
        }
    }
}

/**
 * Register ONE document-level delegated click handler for the category-note
 * PDF-include toggle buttons. Replaces the old per-button listeners, which were
 * lost whenever a tab's results HTML was re-injected (e.g. session restore) and
 * not reliably re-attached — leaving the +/- buttons dead until a page refresh.
 * Delegating on document resolves the button at click time, so it survives any
 * innerHTML swap. Registered once; idempotent.
 */
let _noteToggleDelegated = false;
function setupCategoryNoteToggleListeners() {
    if (_noteToggleDelegated) return;
    _noteToggleDelegated = true;
    document.addEventListener('click', function (e) {
        const btn = e.target.closest && e.target.closest('.toggle-note-pdf-btn');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        applyCategoryNoteToggle(btn);
    }, true);
}

// Make the function globally available
window.setupCategoryNoteToggleListeners = setupCategoryNoteToggleListeners;

// Register the delegated handler once at module load — like the other delegated
// handlers (arrow steppers, highlight mouseup). The per-render callers are now
// redundant (the function self-guards), but harmless if any remain.
setupCategoryNoteToggleListeners();

// Document-level delegated handler for "remove all from PDF" checkbox changes.
// This is the RELIABLE mechanism for the live teacher-note transform: the
// per-element change handlers (across three setup functions, and lost on restore
// re-renders) didn't fire consistently, so we drive the note add/subtract from a
// single delegated listener that catches every .remove-all-checkbox change
// regardless of attachment. (Same lesson as the restore dead-controls fix.)
document.addEventListener('change', function (e) {
    const t = e.target;
    if (t && t.classList && t.classList.contains('remove-all-checkbox')) {
        if (window.applyRemoveAllToTeacherNoteFor) window.applyRemoveAllToTeacherNoteFor(t);
    }
}, true);

/**
 * Setup event listeners for highlight changes
 */
function setupHighlightChangeListeners() {
    if (!window.eventBus) {
        console.warn('EventBus not available for highlight change listeners');
        return;
    }

    // Listen for highlight updates (when user saves edits)
    window.eventBus.on('highlight:updated', (data) => {

        // Refresh all highlights sections (both single and batch)
        refreshHighlightsSection('highlights-content');

        // Also refresh batch essay highlights sections (check for multiple)
        for (let i = 0; i < 50; i++) {
            const contentId = `highlights-content-${i}`;
            if (document.getElementById(contentId)) {
                refreshHighlightsSection(contentId);
            }
        }

        // Keep the durable remove-all state applied to any new/edited marks, so
        // it stays correct on screen without waiting for the next export sync.
        syncAllRemoveAllStateToMarks();
    });

    // Listen for highlight removals
    window.eventBus.on('highlight:removed', (data) => {

        // Refresh all highlights sections
        refreshHighlightsSection('highlights-content');

        // Also refresh batch essay highlights sections
        for (let i = 0; i < 50; i++) {
            const contentId = `highlights-content-${i}`;
            if (document.getElementById(contentId)) {
                refreshHighlightsSection(contentId);
            }
        }

        syncAllRemoveAllStateToMarks();
    });
}

// Setup event listeners when module loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHighlightChangeListeners);
} else {
    setupHighlightChangeListeners();
}

/**
 * Save an essay to the user's account
 * @param {HTMLElement} btn - The button element clicked
 * @param {number} essayIndex - Essay index (0 for single, N for batch)
 */
async function saveEssayToAccount(btn, essayIndex) {
    // Prevent double-clicks
    if (btn.disabled) return;
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';

    try {
        // Resolve the tab this button lives in. The button is rendered inside
        // a specific tab's pane, so we scope all subsequent lookups to that
        // tab rather than whichever tab is currently active.
        const btnPane = btn.closest && btn.closest('.tab-pane');
        const btnTabId = (btnPane && btnPane.dataset && btnPane.dataset.tabId)
            || (window.TabStore && window.TabStore.activeId())
            || null;
        const scopedQuery = (selector) => {
            if (window.TabStore && btnTabId) {
                return window.TabStore.queryInTab(btnTabId, selector);
            }
            if (window.TabStore) return window.TabStore.activeQuery(selector);
            return document.querySelector(selector);
        };

        // Get rendered HTML from DOM
        // Look within the originating tab's pane first — batch-essay-N and
        // essayContainer are children of the per-tab results div.
        let renderedHTML = '';
        const batchDiv = scopedQuery(`#batch-essay-${essayIndex}`);
        const singleContainer = scopedQuery('#essayContainer');
        if (batchDiv) {
            renderedHTML = batchDiv.innerHTML;
        } else if (singleContainer) {
            // For single essay, grab the results div content
            const resultsDiv = scopedQuery('#results');
            if (resultsDiv) renderedHTML = resultsDiv.innerHTML;
        }

        if (!renderedHTML) {
            alert('No essay content found to save.');
            btn.disabled = false;
            btn.textContent = originalText;
            return;
        }

        // Get essay grading data (JSON). Source from the button's tab, not the
        // active tab — they can differ if the user clicked Save in a background tab.
        let essayData = null;
        const btnTabState = (window.TabStore && btnTabId) ? window.TabStore.get(btnTabId) : null;
        const essayDataObj = (btnTabState && btnTabState.essayData && btnTabState.essayData[essayIndex])
            || window[`essayData_${essayIndex}`];
        const batchData = window.SingleResultModule?.getBatchGradingData?.(btnTabId) || {};

        if (essayDataObj) {
            essayData = essayDataObj;
        } else if (batchData && batchData[essayIndex]) {
            essayData = batchData[essayIndex];
        } else if (window.SingleResultModule) {
            essayData = {
                gradingData: window.SingleResultModule.getCurrentGradingData(),
                originalData: window.SingleResultModule.getCurrentOriginalData()
            };
        }

        if (!essayData) {
            alert('No grading data found to save.');
            btn.disabled = false;
            btn.textContent = originalText;
            return;
        }

        // Get student name
        let studentName = '';
        if (essayDataObj?.originalData?.studentName) {
            studentName = essayDataObj.originalData.studentName;
        } else if (essayDataObj?.essay?.studentName) {
            studentName = essayDataObj.essay.studentName;
        } else if (batchData?.[essayIndex]?.originalData?.studentName) {
            studentName = batchData[essayIndex].originalData.studentName;
        } else if (window.SingleResultModule?.getCurrentOriginalData?.()?.studentName) {
            studentName = window.SingleResultModule.getCurrentOriginalData().studentName;
        }

        if (!studentName) {
            studentName = prompt('Enter student name:');
            if (!studentName) {
                btn.disabled = false;
                btn.textContent = originalText;
                return;
            }
        }

        // Get class profile ID (stored at grading time in essayData)
        let classProfileId = null;
        // 1. From the essay's own data (set at grading time)
        if (essayDataObj?.originalData?.classProfile) {
            classProfileId = essayDataObj.originalData.classProfile;
        }
        // 2. From currentBatchData (set during grading)
        const activeBatchData = (window.TabStore && window.TabStore.active()?.currentBatchData)
            || window.currentBatchData;
        if (!classProfileId && activeBatchData?.originalData?.classProfile) {
            classProfileId = activeBatchData.originalData.classProfile;
        }
        // 3. Fallback: read the dropdown directly
        if (!classProfileId) {
            const gptSelect = window.TabStore
                ? window.TabStore.activeQuery('#classProfile')
                : document.getElementById('classProfile');
            classProfileId = (gptSelect && gptSelect.value) || null;
        }

        // If no class profile found, ask user to select one
        if (!classProfileId) {
            alert('Class profile not found for this essay. Please select the correct class profile at the top of the page and try again.');
            btn.disabled = false;
            btn.textContent = originalText;
            return;
        }

        // POST to API
        const response = await fetch('/api/saved-essays', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                classProfileId,
                studentName,
                renderedHTML,
                essayData
            })
        });

        const result = await response.json();
        if (result.success) {
            btn.textContent = 'Saved!';
            btn.style.background = '#6c757d';
            // Re-enable after 2 seconds so user can save again if needed
            setTimeout(function () {
                btn.disabled = false;
                btn.textContent = 'Save Essay';
                btn.style.background = '#28a745';
            }, 2000);
        } else {
            throw new Error(result.error || 'Save failed');
        }
    } catch (error) {
        console.error('[SAVE_ESSAY] Error:', error);
        alert('Failed to save essay: ' + error.message);
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// Make save function globally available
window.saveEssayToAccount = saveEssayToAccount;