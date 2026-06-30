/**
 * auto-save-grading.js — Cluster G (grading-state + form lock) extracted from
 * auto-save.js.
 *
 * Owns the grading-lifecycle flag and the form-lock behavior: whether a grading
 * run is in progress (persisted so a mid-grade refresh shows the "interrupted"
 * restore variant), and locking/unlocking the grading form per tab. Exposes a
 * small API on window.AutoSaveGrading. auto-save.js (the core save lifecycle)
 * delegates to it through thin local wrappers and re-exports the four public
 * members on window.AutoSaveModule.
 *
 * MUST load BEFORE auto-save.js in index.html — auto-save.js calls into this.
 *
 * Seam with the core: the core persists the gradingInProgress flag in its save
 * payload (reads it via isGradingInProgress()) and clears it during teardown
 * (clearSavedSession) via setGradingInProgress(false). Those two calls are the
 * only state the core touches; everything else here is private.
 *
 * Events: markGradingStarted/Finished dispatch 'grading-started'/'grading-finished'
 * on window (consumed by tab-management.js + form-handling.js) — unchanged.
 */
(function () {
    'use strict';

    let gradingInProgress = false;
    let formLocked = false; // write-only flag mirroring the lock state

    /**
     * Mark that a grading operation has started. Sets the in-memory
     * gradingInProgress flag so that the next save (which happens
     * incrementally as each chunk completes) persists the flag. If the
     * user refreshes mid-grading, the restore modal shows its
     * "interrupted" variant.
     *
     * We intentionally do NOT fire an immediate save here: until the first
     * chunk completes there's no essay data to save, and firing an empty
     * save would just overwrite any legitimate prior session on the server.
     */
    function markGradingStarted() {
        gradingInProgress = true;
        // Emit event so tab-management can disable Grade buttons in other tabs.
        // The originating tab ID is captured at the event site so listeners know
        // which tab to leave enabled.
        try {
            const originTabId = (window.TabStore && window.TabStore.activeId()) || null;
            window.dispatchEvent(new CustomEvent('grading-started', {
                detail: { originTabId }
            }));
        } catch (err) {
            console.error('[AutoSave] Failed to dispatch grading-started:', err);
        }
    }

    /**
     * Mark that a grading operation has finished (success OR failure).
     * Clears the gradingInProgress flag. The next save will persist the
     * cleared state.
     */
    function markGradingFinished() {
        gradingInProgress = false;
        try {
            window.dispatchEvent(new CustomEvent('grading-finished', { detail: {} }));
        } catch (err) {
            console.error('[AutoSave] Failed to dispatch grading-finished:', err);
        }
    }

    /**
     * Public getter for the grading-in-progress state. Other modules use
     * this to decide whether to allow starting a new grading run. The core
     * also reads it here to persist the flag in its save payload.
     */
    function isGradingInProgress() {
        return gradingInProgress;
    }

    /**
     * Seam setter for the core's teardown (clearSavedSession): clear the flag so
     * the next save doesn't re-persist a stale interrupted state. This is the
     * only place outside this module that mutates gradingInProgress.
     */
    function setGradingInProgress(value) {
        gradingInProgress = !!value;
    }

    /**
     * Lock or unlock the grading form in a specific tab pane. When locked:
     *   - Essay entry headers (name/nickname inputs) and text areas are hidden.
     *   - Grade, Add Another Essay, and essay counter controls are disabled.
     *   - An inline message appears next to the grade button pointing users
     *     at the "Clear & Start Fresh" banner button.
     *
     * Phase 7: accepts an optional tabId parameter. When provided, only that
     * tab's form is locked. When omitted or null, ALL tab panes are locked
     * (used by the restore path where every restored tab has completed work).
     *
     * @param {boolean} locked
     * @param {string|null} tabId - Specific tab to lock, or null for all tabs
     */
    function setFormLocked(locked, tabId) {
        formLocked = locked;

        // Collect the tab panes to operate on.
        let panes;
        if (tabId && window.TabStore) {
            const pane = window.TabStore.paneForTab(tabId);
            panes = pane ? [pane] : [];
        } else {
            // No tabId → lock/unlock ALL tab panes
            panes = Array.from(document.querySelectorAll('.tab-pane'));
            if (panes.length === 0) {
                const legacy = document.getElementById('gradingForm');
                if (legacy) panes = [legacy.closest('.tab-pane') || legacy.parentElement];
            }
        }

        panes.forEach(pane => {
            if (!pane) return;
            // Use the [id="..."] attribute selector, not #gradingForm: every tab
            // pane contains an element with id="gradingForm" (duplicate ids
            // across panes), and pane.querySelector('#gradingForm') fails to
            // resolve the per-pane form under duplicate ids (it works only for
            // the first one). The attribute form resolves correctly per pane in
            // both browsers and jsdom — same pattern used for the highlights
            // section lookups.
            const form = pane.querySelector('[id="gradingForm"]');
            if (!form) return;

            // Phase 8: When locked, hide the ENTIRE form — but only if this
            // tab actually has graded results. Empty tabs (no batch data)
            // should keep their form visible so the user sees the blank
            // grading form, not a blank page.
            if (locked) {
                const paneTabId = pane.dataset.tabId;
                const tabState = paneTabId && window.TabStore && window.TabStore.get(paneTabId);
                const hasResults = tabState && tabState.currentBatchData;
                form.style.display = hasResults ? 'none' : '';
            } else {
                form.style.display = '';
            }

            // Also clean up any lingering inline lock messages from the old
            // partial-hide approach (in case they were left from a prior
            // session or an older code version).
            const existingMsg = form.querySelector('.auto-save-lock-message');
            if (existingMsg) existingMsg.remove();
        });
    }

    window.AutoSaveGrading = {
        markGradingStarted,
        markGradingFinished,
        isGradingInProgress,
        setGradingInProgress,
        setFormLocked,
    };
})();
