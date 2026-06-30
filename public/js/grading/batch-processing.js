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

// Track /format call completion so the post-stream auto-save can wait
// until all essays have finished their Stage 2 (/format call) before
// snapshotting renderedHTML. Without this, the save can capture essays
// mid-load ("Brewing thoughts..." placeholder) instead of real rendered
// content, leaving the Category Breakdown uneditable on restore.
// See TODO.md: "INTERMITTENT: Category Breakdown not editable post-restore".
let formatCallsExpected = 0;
let formatCallsDoneIndices = new Set();

// Phase 6: Track which tab a batch grading run belongs to, so async
// streaming callbacks write to the correct tab even if the user has
// switched to a different tab. Set by displayBatchProgress() when a
// batch starts, cleared by clearBatchTabContext() when it ends.
//
// While this is set, all tab-scoped DOM writes in streaming paths use
// tabScopedQuery() / tabScopedQueryAll() which target this specific
// tab instead of the currently-active tab.
let currentBatchTabId = null;

/**
 * Tab-scoped query helper for streaming writes. Uses currentBatchTabId
 * if set; otherwise falls back to the currently active tab (preserves
 * the old activeQuery behavior for non-streaming callers).
 */
function tabScopedQuery(selector) {
    if (currentBatchTabId && window.TabStore) {
        return window.TabStore.queryInTab(currentBatchTabId, selector);
    }
    if (window.TabStore) return window.TabStore.activeQuery(selector);
    return document.querySelector(selector);
}

/** Tab-scoped querySelectorAll equivalent of tabScopedQuery. */
function tabScopedQueryAll(selector) {
    if (currentBatchTabId && window.TabStore) {
        return window.TabStore.queryAllInTab(currentBatchTabId, selector);
    }
    if (window.TabStore) return window.TabStore.activeQueryAll(selector);
    return document.querySelectorAll(selector);
}

/**
 * Resolve a student-row's numeric DOM index from its stable essayId.
 * Returns the index (number) or null if no matching row exists.
 *
 * This is the swap-safety bridge: results/status updates carry the stable
 * essayId, and we map it to the row that actually represents that essay
 * (via data-essay-id), rather than trusting the result's array position.
 */
function resolveRowIndexByEssayId(essayId) {
    if (!essayId) return null;
    const rows = tabScopedQueryAll('.student-row[data-essay-id]');
    for (const row of rows) {
        if (row.dataset.essayId === essayId) {
            const m = /student-row-(\d+)/.exec(row.id || '');
            if (m) return parseInt(m[1], 10);
        }
    }
    return null;
}

/**
 * Set the originating tab for the current batch run. Called by
 * displayBatchProgress() at the start of a new batch.
 */
function setBatchTabContext(tabId) {
    currentBatchTabId = tabId;
    console.log(`[BatchProcessing] batch tab context set: ${tabId}`);
}

/** Clear the batch tab context when the run finishes. */
function clearBatchTabContext() {
    currentBatchTabId = null;
}

/**
 * Return the originating tab ID for the current batch run, or null if
 * no batch is currently in progress. Exposed so form-handling.js can
 * pin its own essayData/currentBatchData writes to the same tab that
 * batch-processing.js scopes its DOM writes to.
 */
function getBatchTabContext() {
    return currentBatchTabId;
}

/**
 * Return the tab state to use for batch-related state writes. Prefers the
 * originating tab (currentBatchTabId) when a batch is in progress, falling
 * back to the active tab otherwise.
 *
 * This mirrors getBatchWriteTabState() in form-handling.js and serves the
 * same purpose: pin async state writes (displayBatchResults, retry-write-
 * back) to the tab that started the operation, so switching tabs mid-grade
 * does not scramble state across tabs.
 */
function getBatchWriteTabState() {
    if (!window.TabStore) return null;
    if (currentBatchTabId) {
        return window.TabStore.get(currentBatchTabId);
    }
    return window.TabStore.active();
}

/**
 * Reset format-call tracking at the start of a new grading run.
 * @param {number} expectedCount - Number of essays in the batch.
 */
function resetFormatCallTracking(expectedCount) {
    formatCallsExpected = expectedCount;
    formatCallsDoneIndices = new Set();
    console.log(`[BatchProcessing] format-call tracking reset: expected=${expectedCount}`);
}

/**
 * Mark an essay's /format call as complete. Idempotent per index — safe
 * to call multiple times from different code paths (loadEssayDetails
 * success/error branches AND updateEssayStatus failure path).
 * @param {number} index - Essay index (global, not chunk-local).
 * @param {string} reason - Short label for debugging (e.g., 'loaded', 'fetch-error').
 */
function markFormatCallComplete(index, reason) {
    if (formatCallsDoneIndices.has(index)) return;
    formatCallsDoneIndices.add(index);
    console.log(
        `[BatchProcessing] format-call complete: index=${index} reason=${reason} ` +
        `(${formatCallsDoneIndices.size}/${formatCallsExpected})`
    );
}

/**
 * Wait until all /format calls for the current batch have completed
 * (success OR failure), or until the timeout elapses.
 * Resolves with { completed, done, expected } — never rejects.
 * @param {number} timeoutMs - Max time to wait before resolving early.
 */
function waitForAllFormatCalls(timeoutMs = 60000) {
    return new Promise(resolve => {
        if (formatCallsExpected === 0) {
            resolve({ completed: true, done: 0, expected: 0 });
            return;
        }
        const startTime = Date.now();
        const check = () => {
            if (formatCallsDoneIndices.size >= formatCallsExpected) {
                resolve({
                    completed: true,
                    done: formatCallsDoneIndices.size,
                    expected: formatCallsExpected
                });
                return;
            }
            if (Date.now() - startTime > timeoutMs) {
                console.warn(
                    `[BatchProcessing] waitForAllFormatCalls timed out: ` +
                    `${formatCallsDoneIndices.size}/${formatCallsExpected} done`
                );
                resolve({
                    completed: false,
                    done: formatCallsDoneIndices.size,
                    expected: formatCallsExpected
                });
                return;
            }
            setTimeout(check, 100);
        };
        check();
    });
}

/**
 * Get a random themed loading message (rotates while an essay is being graded)
 */
function getLoadingMessage() {
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

    // Phase 6: Pin this batch run to the currently-active tab. All subsequent
    // streaming writes go to this tab even if the user switches tabs during
    // grading. Context is cleared when the grading-finished event fires.
    if (window.TabStore) {
        setBatchTabContext(window.TabStore.activeId());
    }

    // Find the results div in the tab that owns this batch run.
    const resultsDiv = tabScopedQuery('#results');
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
                    <div class="student-row" id="student-row-${index}" data-essay-id="${essay.essayId || ''}" data-student-name="${(essay.studentName || '').replace(/"/g, '&quot;')}" style="border: 2px solid #ddd; margin: 10px 0; border-radius: 6px; overflow: hidden;">
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
                            <div id="batch-essay-${index}" data-essay-id="${essay.essayId || ''}" style="padding: 12px;">${getLoadingMessage()}</div>
                        </div>

                        <!-- Highlights Management Tab: single full-width clickable
                             title bar. Mirrors createStudentRowHTML's header in
                             display-utils.js — the "Remove all from PDF" control
                             lives INSIDE the dropdown body, not here. No carrot,
                             hover-fills. -->
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

    // Set up rotating loading message for the first essay only
    // Start with "Processing..." then switch to funny messages after 3 seconds.
    // Scoped to the batch's originating tab so the rotation keeps updating
    // the correct element even if the user switches tabs mid-grading.
    if (batchData.essays.length > 0) {
        const firstEssayMessageElement = tabScopedQuery('#processing-message-0');
        if (firstEssayMessageElement) {
            // After 3 seconds, start rotating funny messages
            setTimeout(() => {
                // Only switch if still processing
                if (firstEssayMessageElement.textContent === 'Processing...') {
                    firstEssayMessageElement.textContent = getLoadingMessage();

                    // Now set up interval for continued rotation
                    window.loadingMessageTimer = setInterval(() => {
                        // Only update if still showing a loading message (not if completed)
                        const currentText = firstEssayMessageElement.textContent;
                        if (currentText !== 'Processing...' && !currentText.includes('✓') && !currentText.includes('✗')) {
                            firstEssayMessageElement.textContent = getLoadingMessage();
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
function updateEssayStatus(index, success, error = null, essayId = null) {
    // Phase 6: this fires from streaming callbacks, which can happen after
    // the user switches to a different tab. Use tabScopedQuery so writes go
    // to the batch's originating tab, not the currently-active tab.
    //
    // Swap-safety: when an essayId is provided, resolve the target row by that
    // stable id (the row carries data-essay-id) and use its numeric index for
    // all subsequent id-keyed DOM lookups. This guarantees status/content lands
    // on the correct student even if array positions ever shift. Falls back to
    // the numeric index for legacy callers.
    const resolvedIndex = (essayId != null)
        ? (resolveRowIndexByEssayId(essayId) ?? index)
        : index;
    index = resolvedIndex;

    const statusElement = tabScopedQuery(`#student-status-${index}`);
    if (!statusElement) return;

    // Clear the loading message timer when the first essay status is updated
    if (index === 0 && window.loadingMessageTimer) {
        clearInterval(window.loadingMessageTimer);
        window.loadingMessageTimer = null;
    }

    // Mark essay as completed
    processingQueue.completedEssays.push(index);

    if (success) {
        statusElement.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="2">
                <path d="M20 6L9 17l-5-5"></path>
            </svg>
        `;

        // Clear any leftover FAILED styling from the row. This matters when a
        // restored failed row is retried successfully: the restore renderer
        // baked in a red ✗ icon, red student name, and pink header background
        // for the failure state, and updating only the inner status would leave
        // the row looking failed-but-checked (contradictory). Reset it to the
        // normal success appearance.
        const studentRow = tabScopedQuery(`#student-row-${index}`);
        if (studentRow) {
            const header = studentRow.querySelector('.student-header-clickable');
            if (header) {
                // Restore the neutral (success) header background + hover.
                header.style.background = '#f8f9fa';
                header.setAttribute('onmouseover', "this.style.backgroundColor='#e9ecef'");
                header.setAttribute('onmouseout', "this.style.backgroundColor='#f8f9fa'");
                // Student-name span was rendered red (#721c24) for failures.
                const nameSpan = header.querySelector('span[style*="721c24"], span[style*="font-weight: 600"]');
                if (nameSpan) nameSpan.style.color = '#333';
                // Clear the standalone failure (✗) icon — the 18px span that
                // holds the restore-time statusIcon. The green check already
                // lives in #student-status, so emptying this avoids a
                // double-checkmark on a retried row.
                const iconSpan = header.querySelector('span[style*="font-size: 18px"]');
                if (iconSpan) {
                    iconSpan.innerHTML = '';
                }
            }

            const downloadBtn = studentRow.querySelector('button[onclick*="downloadIndividualEssay"]');
            if (downloadBtn) {
                downloadBtn.disabled = false;
                downloadBtn.style.background = '#007bff';
                downloadBtn.style.cursor = 'pointer';
            } else if (header) {
                // A restored failed row had no Download button (only success
                // rows render one). After a successful retry, add it so the
                // user can download the now-graded essay.
                const controls = header.querySelector('div[style*="flex-shrink: 0"]')
                    || header.lastElementChild;
                if (controls && !controls.querySelector('button[onclick*="downloadIndividualEssay"]')) {
                    const btn = document.createElement('button');
                    btn.setAttribute('onclick', `event.stopPropagation(); downloadIndividualEssay(${index})`);
                    btn.style.cssText = 'background: #007bff; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-size: 14px; cursor: pointer; white-space: nowrap; font-weight: 600;';
                    btn.textContent = 'Download';
                    controls.appendChild(btn);
                }
            }
        }

    } else {
        // The Retry button carries the stable essayId so a retry always
        // re-grades and writes back to the correct student row.
        const rowEssayId = (tabScopedQuery(`#student-row-${index}`)?.dataset?.essayId) || essayId || '';
        const retryArgs = rowEssayId ? `${index}, '${rowEssayId}'` : `${index}`;
        statusElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M15 9l-6 6M9 9l6 6"></path>
                </svg>
                <span style="color: #dc3545; font-weight: 500;">Did not return</span>
                <button onclick="window.BatchProcessingModule.retryEssay(${retryArgs})"
                        style="padding: 4px 10px; font-size: 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;"
                        onmouseover="this.style.background='#0056b3'"
                        onmouseout="this.style.background='#007bff'">
                    Retry
                </button>
            </div>
            ${error ? `<div style="font-size: 11px; color: #666; margin-top: 4px;">${error}</div>` : ''}
        `;
        // Also place a clear, student-bound placeholder in the essay content
        // area so a failed/never-returned essay is unmistakable and can never
        // be confused for another student's result.
        const failDiv = tabScopedQuery(`#batch-essay-${index}`);
        if (failDiv) {
            failDiv.innerHTML = `
                <div style="padding: 14px; border: 1px dashed #dc3545; border-radius: 6px; background: #fff5f5; color: #842029; font-size: 14px; line-height: 1.5;">
                    <strong>This essay did not return.</strong> We're sorry — nothing was graded for this student.
                    Please click <strong>Retry</strong> above to grade this essay again.
                </div>`;
        }
        // Failed essays will never run loadEssayDetails — mark them done
        // here so waitForAllFormatCalls doesn't hang on missing completions.
        // Safe to call even if loadEssayDetails's error branches already
        // marked it: markFormatCallComplete is idempotent per index.
        markFormatCallComplete(index, 'essay-failed');
    }

    // Activate next essay in queue if there is one
    if (processingQueue.nextInQueue < processingQueue.totalEssays) {
        const nextIndex = processingQueue.nextInQueue;
        const nextStatusElement = tabScopedQuery(`#student-status-${nextIndex}`);

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
                // Update the status indicator with success/failure, keyed by
                // the stable essayId so it lands on the correct student row.
                updateEssayStatus(index, essay.success, essay.error, essay.essayId);

                if (window.EssayManagementModule) {
                    window.EssayManagementModule.markStudentComplete(index, essay.success);
                }
            }, index * 200); // 200ms delay between each completion
        });
    }

    // Find the results div in the batch's originating tab. During streaming
    // restore (loadAndRestore() → displayBatchResults()), the batch tab
    // context is cleared so this falls back to the active tab.
    const resultsDiv = tabScopedQuery('#results');
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
    const preReplaceCheckboxes = tabScopedQueryAll('.remove-all-checkbox');
    preReplaceCheckboxes.forEach(checkbox => {
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
            const checkbox = tabScopedQuery(`.remove-all-checkbox[data-content-id="${contentId}"]`);
            if (checkbox && isChecked) {
                checkbox.checked = true;
                // Tab-scoped key; pass the batch's own tab (currentBatchTabId).
                const key = window.removeAllStorageKey
                    ? window.removeAllStorageKey(contentId, currentBatchTabId)
                    : `removeAllFromPDF_${contentId}`;
                localStorage.setItem(key, 'true');
                console.log(`✅ Restored checked state for ${contentId}`);
            }
        });
    }, 50);

    // Store batch data on the batch's originating tab for download and
    // expand functions. Using the batch origin (not active tab) is critical
    // because displayBatchResults fires after the grade completes, and the
    // user may have switched tabs during grading — TabStore.active() would
    // send state to the wrong tab. Falls back to the active tab when no
    // batch context is set (e.g. direct calls outside the grading flow),
    // and to window globals if TabStore isn't available.
    const batchOriginTabState = getBatchWriteTabState();
    if (batchOriginTabState) {
        batchOriginTabState.currentBatchData = { batchResult, originalData };
    } else {
        window.currentBatchData = { batchResult, originalData };
    }

    // Store essay data for lazy loading when expanded. Pair each result to its
    // original essay by the STABLE essayId, not by array position. If a result
    // and the same-index original disagree on essayId (should never happen now
    // that arrays stay aligned, but this is the safety net against any future
    // desync), find the matching original by id and log a warning rather than
    // risk pairing a student's name with another student's essay.
    if (batchResult.results && originalData && originalData.essays) {
        batchResult.results.forEach((essay, index) => {
            if (!essay.success) return;

            const resultId = essay.essayId || null;
            let essayFromOriginal = originalData.essays[index];

            if (resultId) {
                if (!essayFromOriginal || essayFromOriginal.essayId !== resultId) {
                    const byId = originalData.essays.find(e => e && e.essayId === resultId);
                    if (byId) {
                        console.warn(`[swap-guard] result.essayId ${resultId} did not match originalData.essays[${index}] — re-paired by id`);
                        essayFromOriginal = byId;
                    }
                }
            }

            const snapshot = {
                essay: essay,
                originalData: {
                    ...essayFromOriginal,
                    essayId: resultId || (essayFromOriginal && essayFromOriginal.essayId),
                    index: index,
                    classProfile: originalData.classProfile || null
                }
            };
            if (batchOriginTabState) {
                batchOriginTabState.essayData[index] = snapshot;
                if (resultId) batchOriginTabState.essayData[resultId] = snapshot;
            } else {
                window[`essayData_${index}`] = snapshot;
                if (resultId) window[`essayData_${resultId}`] = snapshot;
            }
        });
    }

    // Show the "Grading complete" banner — but NOT during a session restore.
    // restoreTabDOM() also routes through displayBatchResults() to re-render
    // restored essays; in that case "Grading complete" is wrong (nothing was
    // just graded) and restore shows its own banner instead.
    if (window.AutoSaveModule &&
        !(window.AutoSaveModule.isRestoring && window.AutoSaveModule.isRestoring())) {
        window.AutoSaveModule.showClearButton('Grading complete');
    }
}

/**
 * Toggle student details in batch results
 * @param {number} index - Student index
 */
function toggleStudentDetails(index) {
    const detailsDiv = window.TabStore
        ? window.TabStore.activeQuery(`#student-details-${index}`)
        : document.getElementById(`student-details-${index}`);
    const arrow = window.TabStore
        ? window.TabStore.activeQuery(`#student-arrow-${index}`)
        : document.getElementById(`student-arrow-${index}`);

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
function loadEssayDetails(index, essayId = null) {
    // If we know the essayId, make sure `index` points at the row that
    // actually represents that essay (swap-safety). The row carries
    // data-essay-id; resolving here means content is fetched into and written
    // back to the correct student's row regardless of any positional shift.
    if (essayId != null) {
        const resolved = resolveRowIndexByEssayId(essayId);
        if (resolved != null) index = resolved;
    }

    // Use tabScopedQuery: during streaming, the batch tab context pins the
    // lookup to the originating tab so writes go there even if the user has
    // switched tabs. After streaming ends, the context is cleared and this
    // falls back to the active tab (for user-initiated expansion clicks).
    const essayDiv = tabScopedQuery(`#batch-essay-${index}`);

    // Read essay data by the STABLE essayId first (swap-proof), then fall back
    // to the numeric index for legacy callers. essayData is keyed by both the
    // essayId and the global index during streaming.
    const contextTabId = currentBatchTabId
        || (window.TabStore && window.TabStore.activeId());
    const tabEssayData = (contextTabId && window.TabStore && window.TabStore.get(contextTabId)?.essayData) || null;
    // Prefer the essayId stamped on the target row if not passed explicitly.
    const rowEssayId = essayId || (essayDiv && essayDiv.dataset && essayDiv.dataset.essayId) || null;
    const essayDataEntry =
        (rowEssayId && tabEssayData && tabEssayData[rowEssayId])
        || (rowEssayId && window[`essayData_${rowEssayId}`])
        || (tabEssayData && tabEssayData[index])
        || window[`essayData_${index}`];
    if (!essayDiv || !essayDataEntry) return;

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

    const { essay, originalData } = essayDataEntry;

    // Show loading spinner with themed message
    const loadingMessage = getLoadingMessage();
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
            markFormatCallComplete(index, 'loaded');

            // IMMEDIATE verification: confirm content loaded into correct div
            const verifyDiv = tabScopedQuery(`#batch-essay-${index}`);
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
                    const essayContentDiv = tabScopedQuery(`.formatted-essay-content[data-essay-index="${index}"]`);
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
                    const categoryButtons = tabScopedQueryAll(`#categoryButtons-${index} .category-btn`);

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
                        const essayContainer = tabScopedQuery(`#batch-essay-${index}`);
                        if (essayContainer) {
                            // Wire legacy/GPT highlight spans via the shared helper
                            // (broad selector + .teacher-notes guard + capture-phase
                            // listeners live in highlighting.js, shared with the
                            // restore path in auto-save.js so they can't drift). This
                            // is the initial render, so brandCategory:true resolves and
                            // stamps data-category / data-originalText / title.
                            window.HighlightingModule.wireLegacyHighlightSpans(essayContainer, { brandCategory: true });

                            // Still run the original function for mark elements.
                            // Scope to the color-coded essay, NOT the whole
                            // #batch-essay-N row (which also holds the teacher-notes
                            // block) — parity with the restore path in auto-save.js.
                            const essayContentForHandlers = tabScopedQuery(`.formatted-essay-content[data-essay-index="${index}"]`) || essayContainer;
                            window.HighlightingModule.ensureHighlightClickHandlers(essayContentForHandlers);
                        }
                    }

                    // Initialize the main essay editing module
                    if (window.EssayEditingModule) {
                        window.EssayEditingModule.initializeBatchEssayEditing(index, essay.result, originalData);
                    }

                    // Setup editable elements for score inputs (critical for batch processing).
                    // Pass currentBatchTabId so per-tab batchGradingData writes land
                    // in the originating tab even if the user switched tabs mid-stream.
                    if (window.SingleResultModule && window.SingleResultModule.setupBatchEditableElements) {
                        window.SingleResultModule.setupBatchEditableElements(essay.result, originalData, index, currentBatchTabId);
                    }

                    // Adjust height after all content is loaded
                    const detailsDiv = tabScopedQuery(`#student-details-${index}`);
                    if (detailsDiv && detailsDiv.style.maxHeight !== '0px') {
                        detailsDiv.style.maxHeight = detailsDiv.scrollHeight + 'px';
                    }
                }, 200); // Slightly longer delay to ensure DOM is ready
            } else {
                // Release lock on formatting error
                essayLoadingLock[index] = false;
                markFormatCallComplete(index, 'format-error');
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
            markFormatCallComplete(index, 'fetch-error');
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

    // Prefer the row's stable essayId so the download is always the essay the
    // user is looking at, never a positionally-shifted neighbour.
    const rowEssayId = (tabScopedQuery(`#student-row-${index}`)?.dataset?.essayId)
        || (tabScopedQuery(`#batch-essay-${index}`)?.dataset?.essayId)
        || null;
    const tabEssayData = (window.TabStore && window.TabStore.active()?.essayData) || null;
    const essayData =
        (rowEssayId && tabEssayData && tabEssayData[rowEssayId])
        || (rowEssayId && window[`essayData_${rowEssayId}`])
        || (tabEssayData && tabEssayData[index])
        || window[`essayData_${index}`];
    if (!essayData) {
        console.error('No essay data found for index:', index, 'essayId:', rowEssayId);
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

    const batchData = (window.TabStore && window.TabStore.active()?.currentBatchData)
        || window.currentBatchData;
    if (!batchData) {
        console.error('No batch data available for download');
        return;
    }

    // Use PDF export module if available
    if (window.PDFExportModule && window.PDFExportModule.exportBatchEssays) {
        window.PDFExportModule.exportBatchEssays(batchData);
    } else {
        // Fallback implementation
        console.log('PDF export not available, batch data:', batchData);
        showError('PDF export functionality is not available.', 'PDF Export Error');
    }
}

/**
 * Mark student as complete in batch processing
 * @param {number} index - Student index
 * @param {boolean} completed - Whether to mark as completed
 */
function markStudentComplete(index, completed = true) {
    const checkbox = window.TabStore
        ? window.TabStore.activeQuery(`.mark-complete-checkbox[data-student-index="${index}"]`)
        : document.querySelector(`.mark-complete-checkbox[data-student-index="${index}"]`);
    if (checkbox) {
        checkbox.checked = completed;

        // No visual dimming — the checkbox state itself is sufficient
        // feedback. The old opacity: 0.7 looked like a bug after session
        // restore because the cause (clicking the checkbox) was no longer
        // visible in the user's memory.
        const studentRow = checkbox.closest('.student-row');
        if (studentRow) {
            studentRow.style.opacity = '';
            studentRow.style.backgroundColor = '';
        }
    }
}

/**
 * Get completion status for batch processing
 * @returns {Object} Completion statistics
 */
function getBatchCompletionStatus() {
    const checkboxes = window.TabStore
        ? window.TabStore.activeQueryAll('.mark-complete-checkbox')
        : document.querySelectorAll('.mark-complete-checkbox');
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
    const progressElement = window.TabStore
        ? window.TabStore.activeQuery('#batchProgress')
        : document.getElementById('batchProgress');

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
    const clearCheckboxes = window.TabStore
        ? window.TabStore.activeQueryAll('.mark-complete-checkbox')
        : document.querySelectorAll('.mark-complete-checkbox');
    clearCheckboxes.forEach(checkbox => {
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
    const detailsDiv = window.TabStore
        ? window.TabStore.activeQuery(`#student-details-${index}`)
        : document.getElementById(`student-details-${index}`);
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
async function retryEssay(index, essayId = null) {
    // Resolve to the row that actually represents this essay (swap-safety).
    if (essayId != null) {
        const resolved = resolveRowIndexByEssayId(essayId);
        if (resolved != null) index = resolved;
    }
    console.log(`🔄 Retrying essay at index ${index}${essayId ? ` (essayId ${essayId})` : ''}`);

    // Capture the tab ID at retry-click time. The user is looking at the
    // failed essay in a specific tab; the retry result must write back to
    // THAT tab, not whichever tab is active when the async fetch resolves
    // (the user may switch tabs while the retry is in flight).
    const retryOriginTabId = (window.TabStore && window.TabStore.activeId()) || null;

    // Clear the loading lock to allow fresh load
    essayLoadingLock[index] = false;

    // Get original batch data (stored separately from currentBatchData to avoid conflicts)
    const batchData = (window.TabStore && window.TabStore.active()?.originalBatchDataForRetry)
        || window.originalBatchDataForRetry;
    // Prefer locating the essay by its stable essayId in the original batch
    // (never collapsed), falling back to the numeric index.
    let essay = null;
    if (batchData && batchData.essays) {
        if (essayId != null) {
            essay = batchData.essays.find(e => e && e.essayId === essayId) || null;
        }
        if (!essay) essay = batchData.essays[index] || null;
    }
    if (!batchData || !essay) {
        console.error('❌ Cannot retry: original batch data not found');
        alert('Cannot retry: original essay data not found. Please refresh and try grading again.');
        return;
    }
    // Use the essay's own id for snapshot keying below.
    const retryEssayId = essay.essayId || essayId || null;

    // Update UI to show retrying
    const statusElement = window.TabStore
        ? window.TabStore.activeQuery(`#student-status-${index}`)
        : document.getElementById(`student-status-${index}`);
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
            const retrySnapshot = {
                essay: {
                    index: index,
                    essayId: retryEssayId,
                    success: true,
                    studentName: essay.studentName,
                    studentNickname: essay.studentNickname,
                    result: result
                },
                originalData: {
                    essayId: retryEssayId,
                    studentText: essay.studentText,
                    studentName: essay.studentName,
                    studentNickname: essay.studentNickname,
                    index: index,
                    classProfile: batchData.classProfile || null
                }
            };

            // Write back to the tab the user was in when they clicked retry,
            // not whichever tab is active now (the user may have switched
            // tabs while the retry was in flight). Key by both essayId
            // (swap-proof) and index (legacy).
            const retryTabState = retryOriginTabId && window.TabStore
                ? window.TabStore.get(retryOriginTabId)
                : null;
            if (retryTabState) {
                retryTabState.essayData[index] = retrySnapshot;
                if (retryEssayId) retryTabState.essayData[retryEssayId] = retrySnapshot;
            } else {
                window[`essayData_${index}`] = retrySnapshot;
                if (retryEssayId) window[`essayData_${retryEssayId}`] = retrySnapshot;
            }

            // CRITICAL for persistence: also flip the matching entry in
            // currentBatchData.results from failed → success. The autosave
            // snapshots currentBatchData, and restore reads result.success to
            // decide whether a row is graded or a failure placeholder. Without
            // this, a retried essay saves its content but its result still says
            // success:false, so a refresh reverts it to the failed state.
            const liveBatchData = (retryTabState && retryTabState.currentBatchData)
                || (window.TabStore && window.TabStore.active()?.currentBatchData)
                || window.currentBatchData;
            const results = liveBatchData && liveBatchData.batchResult && liveBatchData.batchResult.results;
            if (Array.isArray(results)) {
                let entry = retryEssayId ? results.find(r => r && r.essayId === retryEssayId) : null;
                if (!entry) entry = results[index];
                if (entry) {
                    entry.success = true;
                    entry.error = null;
                    entry.result = result;
                    if (retryEssayId && !entry.essayId) entry.essayId = retryEssayId;
                    console.log(`[AutoSaveDiag] retry: flipped currentBatchData result to success for ${entry.studentName || index}`);
                } else {
                    console.warn('[AutoSaveDiag] retry: could not find matching result entry to mark success');
                }
            }

            // Update status to success (resets the failed-row styling).
            updateEssayStatus(index, true, null, retryEssayId);

            // Render the freshly-graded essay into the row, replacing the
            // "did not return" placeholder. Without this the status flips to
            // success but the body still shows the failure message.
            essayLoadingLock[index] = false;
            const reloadDiv = tabScopedQuery(`#batch-essay-${index}`);
            if (reloadDiv) {
                // Clear the placeholder so loadEssayDetails' alreadyLoaded guard
                // doesn't short-circuit and so stale content can't linger.
                reloadDiv.innerHTML = '';
            }
            loadEssayDetails(index, retryEssayId);

            // Persist the recovered essay. loadEssayDetails fetches /format
            // asynchronously, so we must wait for the formatted content to
            // actually render before saving — otherwise the snapshot would
            // capture the loading spinner (and a refresh would revert to the
            // failed placeholder). Poll for the rendered content, then save.
            (function saveAfterRetryRender() {
                const SAVE_POLL_MS = 150;
                const SAVE_MAX_MS = 8000;
                const startedAt = Date.now();
                const poll = () => {
                    const div = tabScopedQuery(`#batch-essay-${index}`);
                    const rendered = div && div.querySelector(`.formatted-essay-content[data-essay-index="${index}"]`);
                    if (rendered) {
                        // Small buffer for loadEssayDetails' own 200ms setup
                        // timeout (event wiring) before snapshotting.
                        setTimeout(() => {
                            if (window.AutoSaveModule && window.AutoSaveModule.saveImmediately) {
                                console.log(`[AutoSaveDiag] retry render complete for index ${index} — firing saveImmediately`);
                                window.AutoSaveModule.saveImmediately();
                            }
                        }, 300);
                        return;
                    }
                    if (Date.now() - startedAt > SAVE_MAX_MS) {
                        console.warn(`[AutoSaveDiag] retry save: content did not render within ${SAVE_MAX_MS}ms for index ${index}; saving anyway`);
                        if (window.AutoSaveModule && window.AutoSaveModule.saveImmediately) {
                            window.AutoSaveModule.saveImmediately();
                        }
                        return;
                    }
                    setTimeout(poll, SAVE_POLL_MS);
                };
                poll();
            })();

        } else {
            throw new Error(result.error || 'Grading returned unsuccessful');
        }

    } catch (error) {
        console.error(`❌ Retry failed for essay ${index}:`, error);
        updateEssayStatus(index, false, `Retry failed: ${error.message}`, retryEssayId);
    }
}

// Phase 7 update: Do NOT clear the batch tab context on grading-finished.
// The grading-finished event fires from markGradingFinished in the finally
// block of handleGradingFormSubmission, which runs BEFORE the async format-
// wait block. If we clear here, format calls that are still in-flight lose
// their tab context and write to the wrong tab.
//
// Instead, the context is cleared by the format-wait async block in
// form-handling.js after all format calls complete and the save has fired.
// This ensures tabScopedQuery targets the correct tab for the entire
// lifecycle of the grading run including post-stream format calls.

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
    retryEssay,
    resolveRowIndexByEssayId,
    resetFormatCallTracking,
    markFormatCallComplete,
    waitForAllFormatCalls,
    // Phase 6 exports for testing / debugging
    setBatchTabContext,
    clearBatchTabContext,
    getBatchTabContext,
};