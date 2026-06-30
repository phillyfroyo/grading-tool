/**
 * auto-save-payload.js — Cluster B (payload build / de-dup) extracted from
 * auto-save.js.
 *
 * Builds the POST body for /api/grading-session: serializes the full TabStore
 * state, augments each tab with DOM-derived snapshot data (rendered HTML,
 * checkbox states, score overrides), and emits a legacy primary-tab
 * `sessionData` block for pre-Phase-7 rollback compatibility. This is the
 * payload CONTRACT the server stores and the restore path reads, so its shape
 * and de-dup rules are pinned by autosave-payload-cluster.test.js.
 *
 * Exposes window.AutoSavePayload. Cluster B is internal-only (no externally
 * called window.AutoSaveModule members), so nothing here is re-exported on the
 * public facade — auto-save.js calls in via thin local wrappers.
 *
 * MUST load BEFORE auto-save.js in index.html — the core calls into this.
 *
 * Seam: the legacy sessionData carries the gradingInProgress flag, read via the
 * Cluster G getter window.AutoSaveGrading.isGradingInProgress(). That's the only
 * cross-module state this file touches; everything else comes from its args,
 * window.* globals, and TabStore.
 */
(function () {
    'use strict';

    /**
     * True iff the payload carries at least one batch result (used to decide
     * whether there's anything worth saving / showing the capacity pill for).
     */
    function payloadHasResults(payload) {
        return !!(payload && payload.sessionData &&
            payload.sessionData.currentBatchData &&
            payload.sessionData.currentBatchData.batchResult &&
            payload.sessionData.currentBatchData.batchResult.results &&
            payload.sessionData.currentBatchData.batchResult.results.length);
    }

    /**
     * Read one essay's saved snapshot ({ essay, originalData }) by index,
     * preferring the owning tab's state (the batch-origin tab if a batch is
     * streaming, else the active tab), falling back to the legacy
     * window.essayData_<index> global.
     */
    function readEssayData(index) {
        const batchOriginId = (window.BatchProcessingModule
            && typeof window.BatchProcessingModule.getBatchTabContext === 'function'
            && window.BatchProcessingModule.getBatchTabContext())
            || null;

        const targetTab = window.TabStore && (
            (batchOriginId && window.TabStore.get(batchOriginId))
            || window.TabStore.active()
        );
        if (targetTab && targetTab.essayData && targetTab.essayData[index]) {
            return targetTab.essayData[index];
        }
        return window[`essayData_${index}`];
    }

    /**
     * Gather the DOM-derived state for a single tab's pane: rendered essay
     * HTML, highlight HTML, score overrides, checkbox states. Used by
     * buildPayload to snapshot each tab independently.
     *
     * @param {string} tabId - The tab to gather from
     * @param {Object} tabState - The tab's state from TabStore (for essay count)
     * @param {boolean} omitHTML - Skip rendered HTML to keep payload small
     * @returns {Object} DOM-derived data for this tab
     */
    function gatherTabDOMState(tabId, tabState, omitHTML) {
        const queryInTab = (selector) => {
            if (window.TabStore && tabId) {
                return window.TabStore.queryInTab(tabId, selector);
            }
            return document.querySelector(selector);
        };

        const batchData = tabState?.currentBatchData;
        const resultCount = batchData?.batchResult?.results?.length || 0;

        // Gather essayData entries — prefer the tab's own state.
        //
        // tabState.essayData stores each essay TWICE: once under its numeric
        // index and once under its alphanumeric essayId (see batch-processing.js
        // — essayData[index] = essayData[resultId] = snapshot), for fast id-based
        // lookup at runtime. But restore only ever reads the numeric-index keys
        // (it matches /^essayData_(\d+)$/), so persisting the essayId-keyed copies
        // doubled the essaySnapshots weight for nothing. Each snapshot holds the
        // full essay text + grading result, so this duplication was a large chunk
        // of the payload. Persist ONLY the numeric-index entries.
        const essaySnapshots = {};
        if (tabState && tabState.essayData) {
            for (const [idx, ed] of Object.entries(tabState.essayData)) {
                if (ed && /^\d+$/.test(String(idx))) {
                    essaySnapshots[`essayData_${idx}`] = ed;
                }
            }
        }

        const renderedHTML = {};
        const renderedHTMLEssayIds = {}; // index -> essayId, for swap-safe restore re-pairing
        // NOTE: We intentionally do NOT capture the highlights-tab or
        // highlights-content HTML anymore. Both are derived views, regenerated
        // on demand from the essay's <mark> elements by populateHighlightsContent
        // (display-utils.js) when the user opens the highlights tab/section.
        // Since every manual highlight edit lives in those marks — which are
        // inside renderedHTML, captured below — storing the rendered highlight
        // HTML was pure duplication (2 extra full-HTML copies per essay) and a
        // major driver of the 4.5MB payload 413s. Restore lazy-regenerates them,
        // so nothing is lost. (removeAllStates is still captured below so the
        // "remove all" toggle re-applies after regeneration.)
        if (!omitHTML) {
            for (let i = 0; i < resultCount; i++) {
                const div = queryInTab(`#batch-essay-${i}`);
                const hasContent = div && div.innerHTML.trim() && div.innerHTML.trim() !== 'Loading formatted result...';
                if (hasContent) {
                    renderedHTML[i] = div.innerHTML;
                    // Record which essay this captured HTML belongs to, so that
                    // on restore we inject it into the row with the matching
                    // essayId rather than blindly by index (which slides if any
                    // essay was missing).
                    if (div.dataset && div.dataset.essayId) {
                        renderedHTMLEssayIds[i] = div.dataset.essayId;
                    }
                }
            }
        }

        // Gather mark-complete checkbox states
        const completedEssays = {};
        for (let i = 0; i < resultCount; i++) {
            const cb = queryInTab(`.mark-complete-checkbox[data-student-index="${i}"]`);
            if (cb && cb.checked) completedEssays[i] = true;
        }

        // Gather remove-all checkbox states
        const removeAllStates = {};
        for (let i = 0; i < resultCount; i++) {
            const hlTabCb = queryInTab(`#highlights-tab-${i}-remove-all`);
            if (hlTabCb && hlTabCb.checked) removeAllStates[`highlights-tab-content-${i}`] = true;
            const hlContentCb = queryInTab(`#highlights-content-${i}-remove-all`);
            if (hlContentCb && hlContentCb.checked) removeAllStates[`highlights-content-${i}`] = true;
        }

        // Per-tab score overrides — live inside tabState.batchGradingData now.
        // Keep the saved-payload field name `scoreOverrides` so restoreTabDOM's
        // existing `if (tabData.scoreOverrides)` check keeps working for both
        // old and new payloads.
        const bgd = tabState && tabState.batchGradingData;
        const scoreOverrides = (bgd && Object.keys(bgd).length > 0) ? bgd : null;

        return {
            essaySnapshots,
            renderedHTML,
            renderedHTMLEssayIds,
            completedEssays,
            removeAllStates,
            scoreOverrides,
        };
    }

    /**
     * Build the POST body for /api/grading-session.
     *
     * Phase 7: serializes ALL tabs via TabStore.serialize(), then augments
     * each tab's snapshot with DOM-derived state (rendered HTML, checkbox
     * states, etc.). Also builds a legacy `sessionData` field from the
     * primary grading tab (the batch origin or active tab) for backward
     * compat with old restore code.
     *
     * @param {boolean} omitHTML - If true, skip rendered HTML to keep payload small.
     */
    function buildPayload(omitHTML) {
        if (!window.TabStore) return null;

        // When a batch is currently streaming, the active tab may not be the
        // tab that owns the batch (user may have switched tabs mid-stream).
        // Identify the "primary" tab for backward-compat sessionData.
        const batchOriginId = (window.BatchProcessingModule
            && typeof window.BatchProcessingModule.getBatchTabContext === 'function'
            && window.BatchProcessingModule.getBatchTabContext())
            || null;

        const primaryTabId = batchOriginId || window.TabStore.activeId();
        const primaryTabState = window.TabStore.get(primaryTabId) || window.TabStore.active();
        const primaryBatchData = primaryTabState?.currentBatchData || window.currentBatchData;

        // Diagnostic
        const dbgCBDCount = primaryBatchData?.batchResult?.results?.length;
        const dbgTabEssayCount = primaryTabState
            ? Object.keys(primaryTabState.essayData || {}).length : 0;
        console.log(
            `[AutoSaveDiag] buildPayload entry: ` +
            `currentBatchData.results=${dbgCBDCount ?? 'null'}, ` +
            `tab essayData entries=${dbgTabEssayCount}, ` +
            `tabs=${window.TabStore.count()}`
        );

        // Phase 7: Serialize the full TabStore state, then augment each tab
        // with DOM-derived data (renderedHTML, checkbox states, etc.)
        const tabStoreSnapshot = window.TabStore.serialize();
        for (const tabSnapshot of tabStoreSnapshot.tabs) {
            const tabState = window.TabStore.get(tabSnapshot.id);
            const domState = gatherTabDOMState(tabSnapshot.id, tabState, omitHTML);
            // Merge DOM state into the tab's snapshot
            Object.assign(tabSnapshot, domState);
        }

        // Legacy sessionData: built from the PRIMARY tab (batch origin or
        // active tab) for backward compat. If the old restore code runs
        // (e.g., after a rollback to pre-Phase-7 code), it reads sessionData
        // and restores that one tab's state correctly.
        const primaryResultCount = primaryBatchData?.batchResult?.results?.length || 0;
        let batchDataForPayload = primaryBatchData;
        if (!batchDataForPayload && primaryTabState) {
            // Reconstruct from essayData if batchData is missing
            const results = [];
            const essays = [];
            for (let i = 0; i < 50; i++) {
                const ed = primaryTabState.essayData?.[i];
                if (ed) {
                    results.push(ed.essay);
                    essays.push(ed.originalData);
                }
            }
            if (results.length > 0) {
                batchDataForPayload = {
                    batchResult: { results, totalEssays: results.length },
                    originalData: { essays }
                };
            }
        }
        const primaryDOMState = gatherTabDOMState(primaryTabId, primaryTabState, omitHTML);

        // Legacy sessionData (primary tab only). The current restore path uses
        // tabStoreSnapshot (below); this block is ONLY consumed by the
        // pre-Phase-7 legacy restore fallback (when a build that predates
        // tabStoreSnapshot reads one of our saves — i.e. a rollback). The
        // modern path never reads it.
        //
        // We intentionally DROP the primary tab's renderedHTML (+ essayIds)
        // here. It is a full byte-for-byte duplicate of
        // tabStoreSnapshot.tabs[primary].renderedHTML and was the single
        // largest payload contributor — for a single-tab session it roughly
        // DOUBLED the rendered-HTML cost (measured: ~430KB of a 0.94MB 7-essay
        // save), eating the very ceiling headroom this branch exists to
        // protect. The rollback fallback still restores with NO data loss:
        // currentBatchData + essaySnapshots below are enough for pre-Phase-7
        // code to rebuild each essay by re-rendering through /format (slower,
        // but lossless). highlightsTabHTML/highlightsContentHTML were already
        // dropped earlier for the same regenerable-duplication reason.
        const sessionData = {
            currentBatchData: batchDataForPayload,
            essaySnapshots: primaryDOMState.essaySnapshots,
            // Per-tab score overrides are now captured inside gatherTabDOMState
            // for each tab. Legacy sessionData reflects the primary tab only,
            // which matches how old singleton-based saves worked.
            scoreOverrides: primaryDOMState.scoreOverrides,
            completedEssays: primaryDOMState.completedEssays,
            removeAllStates: primaryDOMState.removeAllStates,
            // gradingInProgress flag lives in auto-save-grading.js — read it via
            // the Cluster G getter (the one cross-module seam in this file).
            gradingInProgress: !!(window.AutoSaveGrading
                && window.AutoSaveGrading.isGradingInProgress()),
        };

        // Diagnostics
        const snapshotCount = Object.keys(primaryDOMState.essaySnapshots).length;
        const renderedCount = Object.keys(primaryDOMState.renderedHTML).length;
        if (snapshotCount < primaryResultCount) {
            console.warn(
                `[AutoSave] buildPayload: snapshot/result MISMATCH — ` +
                `resultCount=${primaryResultCount}, essaySnapshots=${snapshotCount}, ` +
                `renderedHTML=${renderedCount}.`
            );
        } else {
            console.log(
                `[AutoSave] buildPayload: resultCount=${primaryResultCount}, ` +
                `essaySnapshots=${snapshotCount}, renderedHTML=${renderedCount}, ` +
                `tabs=${tabStoreSnapshot.tabs.length}`
            );
        }

        return {
            activeTab: 'gpt-grader', // legacy
            sessionData,              // legacy (primary tab only)
            tabStoreSnapshot,          // Phase 7: ALL tabs
        };
    }

    window.AutoSavePayload = {
        payloadHasResults,
        readEssayData,
        gatherTabDOMState,
        buildPayload,
    };
})();
