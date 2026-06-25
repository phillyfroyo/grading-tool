/**
 * Single Result Module
 * Handles display and management of single essay grading results
 */

// Global state for current grading data
let currentGradingData = null;
let currentOriginalData = null;

// Per-tab batchGradingData now lives in TabStore (each tab's state.batchGradingData).
// The helpers below resolve the correct tab and read/write through TabStore so
// writes from one tab can't accidentally clobber another tab's edits during
// multi-tab auto-save/restore.

/**
 * Resolve the tab ID for a given context. Preference order:
 *   1. Explicit tabId argument
 *   2. DOM context: climb from the element to the nearest .tab-pane[data-tab-id]
 *   3. BatchProcessingModule's batch tab context (set during streaming)
 *   4. TabStore.activeId()
 * Returns null if none can be resolved.
 */
function resolveTabId(tabIdOrElement) {
    if (typeof tabIdOrElement === 'string' && tabIdOrElement) {
        return tabIdOrElement;
    }
    if (tabIdOrElement && typeof tabIdOrElement === 'object' && tabIdOrElement.closest) {
        const pane = tabIdOrElement.closest('.tab-pane');
        if (pane && pane.dataset && pane.dataset.tabId) {
            return pane.dataset.tabId;
        }
    }
    if (window.BatchProcessingModule
        && typeof window.BatchProcessingModule.getBatchTabContext === 'function') {
        const ctx = window.BatchProcessingModule.getBatchTabContext();
        if (ctx) return ctx;
    }
    if (window.TabStore && typeof window.TabStore.activeId === 'function') {
        return window.TabStore.activeId();
    }
    return null;
}

/** Return the batchGradingData map for a given tab, or {} if unavailable. */
function getBatchDataForTab(tabId) {
    const resolved = resolveTabId(tabId);
    if (!resolved || !window.TabStore) return {};
    const state = window.TabStore.get(resolved);
    if (!state) return {};
    if (!state.batchGradingData) state.batchGradingData = {};
    return state.batchGradingData;
}

/**
 * Display results for a single essay
 * @param {Object} gradingResult - The grading result from the server
 * @param {Object} originalData - The original form data
 */
function displayResults(gradingResult, originalData) {
    // Clear any batch data in the current tab when displaying single results.
    // Scoped to the active tab — other tabs' batch data is untouched.
    const activeState = window.TabStore && window.TabStore.active();
    if (activeState) activeState.batchGradingData = {};

    const resultsDiv = window.TabStore ? window.TabStore.activeQuery('#results') : document.getElementById('results');
    if (!resultsDiv) return;

    // Show loading state
    resultsDiv.innerHTML = window.DisplayUtilsModule ?
        window.DisplayUtilsModule.createLoadingSpinner('Formatting essay...') :
        '<div class="loading">Formatting essay...</div>';
    resultsDiv.style.display = 'block';

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
    .then(response => response.json())
    .then(formatted => {
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


    // Add listeners for score inputs (only if not already added)
    document.querySelectorAll('.editable-score:not([data-listener-added])').forEach(input => {
        input.dataset.listenerAdded = 'true';

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

            // Recolor this category's score so the color tracks the new value
            // (a raised score turns green, a lowered one red). Runs LAST so it
            // can never interfere with the score/total update path above.
            if (window.recolorCategoryScore) window.recolorCategoryScore(this);
        });
    });

    // Arrow stepper clicks are handled by the document-level delegated listener
    // (ensureDelegatedArrowStepListener) so they survive results-HTML re-injection
    // on restore. No per-element listener needed here.

    // Setup editing functions integration
    if (window.EditingFunctionsModule) {
        window.EditingFunctionsModule.setupEditableElements();
    }

    // Category-note PDF toggle is handled by a document-level delegated listener
    // registered once at module load (display-utils.js) — no per-render setup.
}

/**
 * Setup editable elements for batch essay results
 * @param {Object} gradingResult - Grading result object
 * @param {Object} originalData - Original form data
 * @param {number} essayIndex - Essay index for batch processing
 * @param {string} [tabId] - Optional explicit tab ID; resolves via fallback chain if omitted.
 *                          Callers operating on a non-active tab (e.g. restore loops,
 *                          background-tab streaming) MUST pass this explicitly.
 */
function setupBatchEditableElements(gradingResult, originalData, essayIndex, tabId) {
    // Clear single essay data when setting up batch
    if (essayIndex === 0) {
        currentGradingData = null;
        currentOriginalData = null;
    }

    const resolvedTabId = resolveTabId(tabId);
    const tabBatchData = getBatchDataForTab(resolvedTabId);

    // Resolve the essay container scoped to the target tab, not the active tab.
    // During multi-tab restore and background-tab streaming, the active tab is
    // not necessarily the tab we're setting up for.
    //
    // queryInTab with an explicit tabId returns null (not a cross-tab match)
    // if the pane lacks the element, which is what we want — silently falling
    // back to the active tab's element would corrupt cross-tab state.
    const essayContainer = (window.TabStore && resolvedTabId)
        ? window.TabStore.queryInTab(resolvedTabId, `#batch-essay-${essayIndex}`)
        : (window.TabStore
            ? window.TabStore.activeQuery(`#batch-essay-${essayIndex}`)
            : document.getElementById(`batch-essay-${essayIndex}`));

    if (!essayContainer && resolvedTabId) {
        // Diagnostic: the target tab's pane doesn't contain #batch-essay-N.
        // This usually means the pane hasn't been populated with the batch
        // template yet. The caller should retry or the template injection
        // should precede this call. Data is still written to the tab's
        // batchGradingData so no edits are lost, but listeners can't attach.
        console.warn(
            `[setupBatchEditableElements] No #batch-essay-${essayIndex} in tab ${resolvedTabId}. ` +
            `Listeners not attached. This likely means the batch template hasn't rendered yet.`
        );
    }

    // Store data for this specific essay index. IMPORTANT: this write happens
    // BEFORE the listenersAttached guard so that re-entries (e.g. during
    // restore) populate tab state even when listener attachment is skipped.
    //
    // To avoid clobbering restored user edits, read any DOM input values that
    // are already present and layer them on top of the incoming gradingResult.
    // During restore, applyScoreOverrides writes edited values into inputs
    // BEFORE setupBatchEditableElements runs (via the 250ms reattach timeout),
    // so we preserve them here instead of overwriting with raw AI scores.
    const mergedGradingData = { ...gradingResult };
    if (mergedGradingData.scores && essayContainer) {
        mergedGradingData.scores = { ...mergedGradingData.scores };
        essayContainer.querySelectorAll('.editable-score').forEach(input => {
            const category = input.dataset.category;
            if (!category || !mergedGradingData.scores[category]) return;
            const domValue = parseFloat(input.value);
            if (!Number.isNaN(domValue)) {
                mergedGradingData.scores[category] = {
                    ...mergedGradingData.scores[category],
                    points: domValue,
                };
            }
        });
        essayContainer.querySelectorAll('.editable-feedback').forEach(textarea => {
            const category = textarea.dataset.category;
            if (!category || !mergedGradingData.scores[category]) return;
            if (typeof textarea.value === 'string' && textarea.value.length > 0) {
                mergedGradingData.scores[category] = {
                    ...mergedGradingData.scores[category],
                    rationale: textarea.value,
                };
            }
        });
    }
    tabBatchData[essayIndex] = {
        gradingData: mergedGradingData,
        originalData: { ...originalData }
    };

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
                    // Resolve tab at FIRE time, not attach time. The element
                    // lives inside a specific .tab-pane, so closest() gives us
                    // the correct owner regardless of active-tab state.
                    const eventTabId = resolveTabId(this);
                    const batchData = getBatchDataForTab(eventTabId);

                    // Get the essay index from the input's data attribute
                    const currentEssayIndex = parseInt(this.dataset.essayIndex);
                    const category = this.dataset.category;
                    const newPoints = parseFloat(this.value) || 0;
                    const maxPoints = parseFloat(this.max) || 15;

                    // Validate range
                    if (newPoints < 0) this.value = 0;
                    if (newPoints > maxPoints) this.value = maxPoints;

                    // Update data for this specific essay in this specific tab
                    if (batchData[currentEssayIndex] &&
                        batchData[currentEssayIndex].gradingData.scores &&
                        batchData[currentEssayIndex].gradingData.scores[category]) {
                        batchData[currentEssayIndex].gradingData.scores[category].points = parseFloat(this.value);
                    }

                    // Recalculate total score for this specific essay in this specific tab
                    updateTotalScore(currentEssayIndex, eventTabId);

                    // Recolor this category's score to track the new value.
                    // Runs LAST so it can never interfere with the score/total
                    // update path above.
                    if (window.recolorCategoryScore) window.recolorCategoryScore(this);
                });
            }
        });

        // Arrow stepper clicks are handled by the document-level delegated
        // listener (ensureDelegatedArrowStepListener), so they survive the
        // results-HTML re-injection that happens on session restore. No
        // per-element listener is attached here.
    }

    // Add listeners for feedback textareas within the specific essay container
    if (essayContainer) {
        essayContainer.querySelectorAll('.editable-feedback').forEach(textarea => {
            textarea.addEventListener('input', function() {
                // Resolve tab + essayIndex at FIRE time for the same reason as
                // the score input listener above.
                const eventTabId = resolveTabId(this);
                const batchData = getBatchDataForTab(eventTabId);
                const category = this.dataset.category;

                // The textarea lives inside .category-row > .score-input or similar;
                // walk up to the essay container to get the index reliably.
                const container = this.closest('[id^="batch-essay-"]');
                const currentEssayIndex = container
                    ? parseInt(container.id.replace('batch-essay-', ''), 10)
                    : essayIndex;

                if (batchData[currentEssayIndex] &&
                    batchData[currentEssayIndex].gradingData.scores &&
                    batchData[currentEssayIndex].gradingData.scores[category]) {
                    batchData[currentEssayIndex].gradingData.scores[category].rationale = this.value;
                }
            });

            // Auto-resize textarea on user input
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.max(34, this.scrollHeight) + 'px';
            });
        });

        // Auto-resize all feedback textareas after the browser has had a
        // chance to lay out the DOM and compute line wrapping. The
        // synchronous resize we had before ran before the browser painted,
        // so scrollHeight reflected single-line height even for wrapped
        // content. requestAnimationFrame + a small setTimeout ensures the
        // layout pass has completed.
        requestAnimationFrame(() => {
            setTimeout(() => {
                essayContainer.querySelectorAll('.editable-feedback').forEach(ta => {
                    ta.style.height = 'auto';
                    ta.style.height = Math.max(34, ta.scrollHeight) + 'px';
                });
            }, 50);
        });
    }

    // Setup editing functions integration
    if (window.EditingFunctionsModule) {
        window.EditingFunctionsModule.setupEditableElements();
    }

    // Category-note PDF toggle is handled by a document-level delegated listener
    // registered once at module load (display-utils.js) — no per-render setup.
}

/**
 * Gap-resilient delegated handler for batch score/feedback edits.
 *
 * WHY THIS EXISTS: the per-input listeners in setupBatchEditableElements are
 * the primary path, but on a Keep-restore they're attached behind two stacked
 * 250ms setTimeouts (auto-save.js reattachHandlers → setupBatchEditableElements).
 * For ~500ms after restore the inputs are visible and editable but unwired. An
 * edit in that window changed the input's value but never wrote it into
 * tabState.batchGradingData — so the overall grade didn't recompute live, and
 * the next autosave persisted the STALE override. After a refresh the edit
 * silently reverted. (The document-level input listener in auto-save.js fired a
 * save, but it reads batchGradingData, which was never updated.)
 *
 * This document-level delegated listener closes that gap: it resolves the tab,
 * essay index, and category straight from the edited element, writes the value
 * into batchGradingData, and recomputes the total — with zero dependency on the
 * per-input listeners having attached yet. It is idempotent with them (writing
 * the same value twice is a no-op), and it only acts on inputs that live inside
 * a #batch-essay-N container, so the single-essay path is untouched.
 */
function handleDelegatedBatchEdit(target) {
    const container = target.closest && target.closest('[id^="batch-essay-"]');
    if (!container) return; // not a batch essay edit — leave to other handlers

    const m = /^batch-essay-(\d+)$/.exec(container.id || '');
    if (!m) return;
    const essayIndex = parseInt(m[1], 10);
    const category = target.dataset && target.dataset.category;
    if (!category) return;

    const eventTabId = resolveTabId(target);
    const batchData = getBatchDataForTab(eventTabId);
    const entry = batchData[essayIndex];
    // If the essay's grading data hasn't been populated yet, there's nothing to
    // safely write into — the per-input path (which also seeds batchData) will
    // take over once setupBatchEditableElements runs. Bail rather than guess.
    if (!entry || !entry.gradingData || !entry.gradingData.scores ||
        !entry.gradingData.scores[category]) {
        return;
    }

    if (target.classList.contains('editable-score')) {
        const maxPoints = parseFloat(target.max) || 15;
        let v = parseFloat(target.value);
        if (Number.isNaN(v)) return; // mid-edit empty field — don't clobber
        if (v < 0) { v = 0; target.value = 0; }
        if (v > maxPoints) { v = maxPoints; target.value = maxPoints; }
        entry.gradingData.scores[category].points = v;
        updateTotalScore(essayIndex, eventTabId);
        if (window.recolorCategoryScore) window.recolorCategoryScore(target);
    } else if (target.classList.contains('editable-feedback')) {
        entry.gradingData.scores[category].rationale = target.value;
    }
}

// Register the delegated handler once. Uses the capture phase so it runs
// regardless of whether the per-input listeners (added later, on the bubble
// phase) exist yet — and because it's idempotent, double-handling is harmless.
let _delegatedBatchEditWired = false;
function ensureDelegatedBatchEditListener() {
    if (_delegatedBatchEditWired) return;
    _delegatedBatchEditWired = true;
    document.addEventListener('input', function (e) {
        const t = e.target;
        if (!t || !t.classList) return;
        if (t.classList.contains('editable-score') ||
            t.classList.contains('editable-feedback')) {
            handleDelegatedBatchEdit(t);
        }
    }, true);
}
ensureDelegatedBatchEditListener();

/**
 * Document-level delegated click handler for the category score +/- arrow
 * steppers (.arrow-up-area / .arrow-down-area). The per-element click listeners
 * (attached in setupBatchEditableElements / single-result render) are lost when
 * a tab's results HTML is re-injected (e.g. session restore) and not reliably
 * re-attached, leaving the arrows dead until a page refresh. This delegated
 * handler resolves the arrow at click time, so stepping always works regardless
 * of per-element reattachment.
 *
 * It mirrors the old per-element logic exactly: step the sibling .editable-score
 * by ±1 within its min/max and dispatch a bubbling 'input' event, which the
 * score update + autosave handlers already act on. This is now the ONLY arrow
 * handler (the per-element ones were removed), so there's no double-step risk.
 * Registered once.
 */
let _arrowStepDelegated = false;
function ensureDelegatedArrowStepListener() {
    if (_arrowStepDelegated) return;
    _arrowStepDelegated = true;
    document.addEventListener('click', function (e) {
        const arrow = e.target.closest && e.target.closest('.arrow-up-area, .arrow-down-area');
        if (!arrow) return;
        // Only category-SCORE steppers. The essay-COUNT stepper on the form uses
        // the same arrow classes but carries .essay-counter-arrow + data-target
        // and is driven by its own handler in essay-management.js — leave it be.
        if (arrow.classList.contains('essay-counter-arrow') || arrow.dataset.target) return;

        const input = arrow.parentElement && arrow.parentElement.querySelector('.editable-score');
        if (!input) return; // not a score stepper context
        e.preventDefault();
        const currentValue = parseFloat(input.value) || 0;
        const max = parseFloat(input.max) || 15;
        const min = parseFloat(input.min) || 0;
        let newValue = currentValue;
        if (arrow.classList.contains('arrow-up-area')) {
            newValue = Math.min(currentValue + 1, max);
        } else if (arrow.classList.contains('arrow-down-area')) {
            newValue = Math.max(currentValue - 1, min);
        }
        if (newValue !== currentValue) {
            input.value = newValue;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }, true);
}
ensureDelegatedArrowStepListener();

/**
 * Update total score display
 * @param {number} essayIndex - Optional essay index for batch processing
 * @param {string} [tabId] - Optional tab ID. When omitted, resolves via fallback chain.
 *                          Callers that already resolved tabId at event-fire time should
 *                          propagate it here to avoid redundant resolution.
 */
function updateTotalScore(essayIndex = null, tabId) {
    const resolvedTabId = (essayIndex !== null) ? resolveTabId(tabId) : null;
    let gradingData;

    // Determine which data to use based on whether this is batch or single
    if (essayIndex !== null) {
        const batchData = getBatchDataForTab(resolvedTabId);
        if (batchData[essayIndex]) {
            gradingData = batchData[essayIndex].gradingData;
        }
    } else {
        gradingData = currentGradingData;
    }

    if (!gradingData || !gradingData.scores) return;

    let totalPoints = 0;
    let totalMaxPoints = 0;

    Object.values(gradingData.scores).forEach(score => {
        totalPoints += score.points || 0;
        totalMaxPoints += score.out_of || 0;
    });

    // Update stored data
    if (gradingData.total) {
        gradingData.total.points = totalPoints;
        gradingData.total.out_of = totalMaxPoints;
    }

    // Update the displayed total score
    let overallScoreElement;
    if (essayIndex !== null) {
        // For batch processing, find the overall score within the specific
        // essay container scoped to the target tab (not the active tab).
        const essayContainer = (window.TabStore && resolvedTabId)
            ? window.TabStore.queryInTab(resolvedTabId, `#batch-essay-${essayIndex}`)
            : (window.TabStore
                ? window.TabStore.activeQuery(`#batch-essay-${essayIndex}`)
                : document.getElementById(`batch-essay-${essayIndex}`));
        overallScoreElement = essayContainer ? essayContainer.querySelector('.overall-score') : null;
    } else {
        // For single essays, scope to the active tab pane
        overallScoreElement = window.TabStore
            ? window.TabStore.activeQuery('.overall-score')
            : document.querySelector('.overall-score');
    }

    if (overallScoreElement) {
        // Use the same simple format as the initial display to maintain consistency
        overallScoreElement.innerHTML = `${totalPoints}/${totalMaxPoints}`;

        // Recolor the overall score so it tracks the new total (greener as the
        // grade rises, redder as it falls). Use getCategoryScoreColor — it
        // matches the backend formatter's getScoreColor palette exactly, so the
        // live color is identical to the AI-rendered one (window.getScoreColor
        // is a DIFFERENT bootstrap palette and must NOT be used here). The
        // overall score is out of 100, so totalPoints is already a percentage.
        // Purely cosmetic; wrapped so a recolor error can't affect the score
        // path above.
        try {
            const colorFn = window.getCategoryScoreColor;
            if (typeof colorFn === 'function' && totalMaxPoints > 0) {
                const pct = Math.round((totalPoints / totalMaxPoints) * 100);
                overallScoreElement.style.color = colorFn(pct);
            }
        } catch (e) {
            console.warn('[updateTotalScore] overall recolor skipped:', e && e.message);
        }
    }

    // Update individual category displays if needed
    updateCategoryPercentages(essayIndex, resolvedTabId);
}

/**
 * Update category percentage displays
 * @param {number} essayIndex - Optional essay index for batch processing
 * @param {string} [tabId] - Optional tab ID; propagated from updateTotalScore.
 */
function updateCategoryPercentages(essayIndex = null, tabId) {
    const resolvedTabId = (essayIndex !== null) ? resolveTabId(tabId) : null;
    // Determine which data to use
    let gradingData;
    if (essayIndex !== null) {
        const batchData = getBatchDataForTab(resolvedTabId);
        if (batchData[essayIndex]) {
            gradingData = batchData[essayIndex].gradingData;
        }
    } else {
        gradingData = currentGradingData;
    }

    if (!gradingData || !gradingData.scores) return;

    // Update percentages for the appropriate container.
    // Default to the active tab pane so single-essay updates stay scoped.
    let container = (window.TabStore && window.TabStore.activePane()) || document;
    if (essayIndex !== null) {
        const essayContainer = (window.TabStore && resolvedTabId)
            ? window.TabStore.queryInTab(resolvedTabId, `#batch-essay-${essayIndex}`)
            : (window.TabStore
                ? window.TabStore.activeQuery(`#batch-essay-${essayIndex}`)
                : document.getElementById(`batch-essay-${essayIndex}`));
        container = essayContainer || container;
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
 * @param {string} [tabId] - Optional tab ID; callers that know their DOM context
 *                          should resolve this from the element and pass it in.
 */
function updateBatchScore(essayIndex, category, points, maxPoints, tabId) {
    const resolvedTabId = resolveTabId(tabId);
    const batchData = getBatchDataForTab(resolvedTabId);
    if (!batchData[essayIndex]) {
        console.warn(`No batch grading data for essay ${essayIndex} in tab ${resolvedTabId}`);
        return;
    }

    const data = batchData[essayIndex].gradingData;
    if (data && data.scores && data.scores[category]) {
        data.scores[category].points = points;
        data.scores[category].out_of = maxPoints;

        // Trigger total score update for the same tab
        updateTotalScore(essayIndex, resolvedTabId);
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

// Auto-resize all feedback textareas when the window resizes (handles
// browser narrow/widen causing text to wrap/unwrap). Debounced to avoid
// excessive reflows during drag-resize.
let resizeDebounce = null;
window.addEventListener('resize', function() {
    if (resizeDebounce) clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(function() {
        document.querySelectorAll('.editable-feedback').forEach(function(ta) {
            ta.style.height = 'auto';
            ta.style.height = Math.max(34, ta.scrollHeight) + 'px';
        });
    }, 150);
});

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
    // Tab-aware accessor. Pass a tabId to read a specific tab's batch data;
    // omit to read the active tab's (or whichever tab the resolver picks).
    // Returns {} if the tab or store is unavailable.
    getBatchGradingData: (tabId) => getBatchDataForTab(tabId)
};