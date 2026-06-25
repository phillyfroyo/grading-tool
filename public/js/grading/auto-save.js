/**
 * Auto-Save Module
 * Persists grading session data to the database so results survive page reloads.
 * Exposes window.AutoSaveModule.
 */
(function () {
    'use strict';

    // --- State ---
    let isSaving = false;
    let isRestoring = false;
    let debounceTimer = null;
    let initialized = false;
    let lastSuccessfulSaveTime = 0;
    let hasPendingChanges = false;
    let gradingInProgress = false;
    let formLocked = false;
    const DEBOUNCE_MS = 2500;

    // Auth-expired state: when the server rejects a save with 401/403, the
    // session has lapsed. Retrying the same request is futile (it will 401
    // forever), so we stop the retry loop, stash the unsaved payload durably,
    // and prompt re-authentication. Once re-authed, we flush the stash.
    let authExpired = false;
    // localStorage key under which the last unsaved payload is mirrored, so a
    // tab close/crash before re-auth doesn't lose the graded work.
    const PENDING_SAVE_KEY = 'gradingTool.pendingSave.v1';

    // --- Payload-size budget + capacity meter (prevents Vercel 4.5MB 413s) ---
    // Vercel's serverless request/response body limit is ~4.5MB. The autosave
    // serializes the WHOLE session (all tabs) into one request, so total size is
    // what matters. We budget below 4.5MB for headroom (JSON overhead + keeping
    // the GET/load of the same blob under the limit too). "Capacity" is measured
    // against this ceiling: 100% = the hard stop. We surface it as a persistent
    // chip and escalating warnings so the teacher can finish/clear tabs before
    // saving fails — instead of being blindsided. At 100% we block edits that
    // grow the payload (new highlights); score edits (tiny, via scoreOverrides)
    // and already-saved work are unaffected.
    const PAYLOAD_CEILING_BYTES = 3_800_000;       // 100% capacity / hard stop (≈3.8MB)
    let payloadOverBudget = false;                 // true once at/over ceiling
    let lastPayloadBytes = 0;                       // diagnostics + chip
    let lastCapacityBucket = -1;                    // highest threshold toast shown
    // Threshold buckets (percent of ceiling) → escalating guidance. Only fire on
    // an UPWARD crossing into a higher bucket, so the teacher isn't spammed.
    const CAPACITY_THRESHOLDS = [
        { pct: 70, level: 'warn',  msg: 'Autosave is at {P}% capacity. Plan to finish and clear some essays soon.' },
        { pct: 85, level: 'warn',  msg: 'Autosave is at {P}% capacity. Download completed essays and clear a finished tab to keep saving reliably.' },
        { pct: 95, level: 'warn',  msg: 'Autosave is nearly full ({P}%). Clear a finished tab now to avoid interrupting saves.' },
    ];

    // --- Public API ---

    function initialize() {
        if (initialized) return;
        initialized = true;

        // Debounced save on score / feedback edits (event delegation)
        document.addEventListener('input', function (e) {
            if (
                e.target.classList.contains('editable-score') ||
                e.target.classList.contains('editable-feedback') ||
                e.target.classList.contains('score-input') ||
                e.target.closest('.editable-score') ||
                e.target.closest('.editable-feedback')
            ) {
                debouncedSave();
            }
        });

        // Save on checkbox changes: mark-complete, remove-from-PDF toggles
        document.addEventListener('change', function (e) {
            if (
                e.target.classList.contains('mark-complete-checkbox') ||
                e.target.classList.contains('remove-all-checkbox')
            ) {
                debouncedSave();
            }
        });

        // Save on click for toggle buttons: category note PDF toggle, highlight PDF toggle
        document.addEventListener('click', function (e) {
            if (
                e.target.classList.contains('toggle-note-pdf-btn') ||
                e.target.classList.contains('toggle-pdf-btn') ||
                e.target.closest('.toggle-note-pdf-btn') ||
                e.target.closest('.toggle-pdf-btn')
            ) {
                debouncedSave();
            }
        });

        // Save on event bus events: highlight edits, teacher notes
        function listenToEventBus() {
            if (window.eventBus) {
                window.eventBus.on('highlight:updated', function () { debouncedSave(); });
                window.eventBus.on('highlight:removed', function () { debouncedSave(); });
                window.eventBus.on('teacher-notes:saved', function () { debouncedSave(); });
            } else {
                // eventBus module may not have loaded yet; retry shortly
                setTimeout(listenToEventBus, 500);
            }
        }
        listenToEventBus();

        // No beforeunload beacon — the DOM is unreliable during page teardown
        // and stale/empty payloads have been overwriting good DB data.
        // Debounced saves (2.5s) and immediate saves cover all edit scenarios.

        // Recover an orphaned stash: if a previous session lost auth and the
        // user closed the tab before re-authenticating, their unsaved work is
        // still in localStorage. On this fresh load auth may be healthy again
        // (they logged in to get here), so try to flush it. Done after restore
        // so the live state, if any, takes precedence.
        setTimeout(recoverOrphanedStash, 1500);

        // Reveal the capacity pill on load for a restored session, so its
        // fullness is visible immediately rather than only after the user's
        // first edit. Deferred so any session restore (async: modal → /format
        // re-render) has populated the DOM first. No-op on an empty fresh form.
        setTimeout(refreshCapacityDisplay, 1800);

        console.log('[AutoSave] Initialized');
    }

    /**
     * True if a built payload actually contains graded results (vs. an empty
     * fresh form). Used to decide whether there's live grading state worth
     * acting on — by stash recovery and the on-load capacity reveal.
     * @param {object|null} payload - output of buildPayload()
     */
    function payloadHasResults(payload) {
        return !!(payload && payload.sessionData &&
            payload.sessionData.currentBatchData &&
            payload.sessionData.currentBatchData.batchResult &&
            payload.sessionData.currentBatchData.batchResult.results &&
            payload.sessionData.currentBatchData.batchResult.results.length);
    }

    /**
     * On a fresh page load, if a pending-save stash exists from a prior
     * auth-expired session, upload it (auth is presumably healthy now). Only
     * uploads the stashed payload when there's no live grading state that would
     * be a better source — restore handles the live case.
     */
    async function recoverOrphanedStash() {
        const stash = readPendingSaveStash();
        if (!stash || !stash.payload) return;
        // If the current page already has live grading state, a normal save
        // will capture it; just clear the older stash to avoid clobbering.
        const live = buildPayload();
        const liveHasResults = payloadHasResults(live);
        if (liveHasResults) {
            console.log('[AutoSave] live state present on load — discarding older orphaned stash');
            clearPendingSaveStash();
            return;
        }
        try {
            console.log('[AutoSave] recovering orphaned stash from a prior session…');
            const resp = await fetch('/api/grading-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(stash.payload),
            });
            if (resp.ok) {
                clearPendingSaveStash();
                updateBannerStatus('Welcome back — we’ve saved your previous work', 'ok');
                console.log('[AutoSave] orphaned stash recovered successfully');
            } else if (resp.status === 401 || resp.status === 403) {
                handleAuthExpired(stash.payload);
            }
            // Other errors: leave the stash in place to retry on next load.
        } catch (e) {
            console.warn('[AutoSave] orphaned stash recovery error:', e && e.message);
        }
    }

    /**
     * Save immediately (called after grading completes).
     */
    /**
     * @param {Object} [options]
     * @param {boolean} [options.quiet] - If true, skip the "Saving..." toast
     *   (the "All changes saved" toast still shows on success). Used by
     *   quick operations like tab add/close/rename where the save completes
     *   so fast that the "Saving..." flash looks glitchy.
     */
    function saveImmediately(options) {
        clearDebounce();
        hasPendingChanges = true;
        if (!options || !options.quiet) {
            updateBannerStatus('Saving\u2026', 'ok');
        }
        return doSave('saveImmediately');
    }

    /**
     * Schedule a debounced save.
     */
    function debouncedSave() {
        clearDebounce();
        hasPendingChanges = true;
        debounceTimer = setTimeout(() => doSave('debouncedSave'), DEBOUNCE_MS);
    }

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
     * this to decide whether to allow starting a new grading run.
     */
    function isGradingInProgress() {
        return gradingInProgress;
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
            const form = pane.querySelector('#gradingForm');
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

    /**
     * Fetch the session existence + metadata WITHOUT running the full restore.
     * Used by promptRestoreIfSaved to decide whether to show the modal.
     * Returns { exists: boolean, essayCount: number, gradingInProgress: boolean }
     * or null on fetch error.
     */
    async function peekSavedSession() {
        try {
            const resp = await fetch('/api/grading-session');
            if (!resp.ok) return { exists: false };
            const data = await resp.json();
            if (!data.exists) return { exists: false };

            const sessionData = data.sessionData || {};
            const tabStoreSnapshot = data.tabStoreSnapshot;

            // Count essays — prefer the multi-tab snapshot, fall back to legacy
            let essayCount = 0;
            let tabCount = 1;
            if (tabStoreSnapshot && Array.isArray(tabStoreSnapshot.tabs)) {
                tabCount = tabStoreSnapshot.tabs.length;
                for (const tab of tabStoreSnapshot.tabs) {
                    const results = tab.currentBatchData?.batchResult?.results;
                    if (Array.isArray(results)) essayCount += results.length;
                }
            } else {
                const results = sessionData.currentBatchData?.batchResult?.results;
                essayCount = Array.isArray(results) ? results.length : 0;
            }

            return {
                exists: true,
                essayCount,
                tabCount,
                gradingInProgress: !!sessionData.gradingInProgress
            };
        } catch (err) {
            console.warn('[AutoSave] peekSavedSession failed:', err);
            return null;
        }
    }

    /**
     * Page-load entry point. Checks the server for a saved session and,
     * if one exists, shows a non-dismissible modal asking the user whether
     * to keep or discard the saved work.
     *   - Keep  → run loadAndRestore() + setFormLocked(true).
     *   - Discard → run clearSavedSession().
     * If no saved session exists, this is a no-op (fresh form stays as-is).
     */
    async function promptRestoreIfSaved() {
        const peek = await peekSavedSession();
        if (!peek || !peek.exists) {
            return false;
        }

        // If there are no graded essays, check whether there's anything
        // worth showing the modal for. Multiple empty tabs should be
        // silently restored (preserves the tab layout). A single empty
        // tab is the default state — skip entirely.
        if (peek.essayCount === 0) {
            if (peek.tabCount > 1) {
                // Silently restore the tab layout, no modal needed.
                await loadAndRestore();
                return true;
            }
            // Single empty tab — nothing to restore, fresh start.
            return false;
        }

        // Build the modal copy based on whether the session was interrupted.
        const modal = document.getElementById('restoreSessionModal');
        const titleEl = document.getElementById('restoreSessionTitle');
        const messageEl = document.getElementById('restoreSessionMessage');
        const keepBtn = document.getElementById('restoreSessionKeepBtn');
        const discardBtn = document.getElementById('restoreSessionDiscardBtn');

        if (!modal || !titleEl || !messageEl || !keepBtn || !discardBtn) {
            console.error('[AutoSave] restoreSessionModal elements missing; falling back to silent restore');
            await loadAndRestore();
            setFormLocked(true);
            return true;
        }

        const essayWord = peek.essayCount === 1 ? 'essay' : 'essays';
        const tabNote = (peek.tabCount && peek.tabCount > 1)
            ? ` across ${peek.tabCount} tabs`
            : '';
        if (peek.gradingInProgress) {
            titleEl.textContent = 'Your last grading session was interrupted';
            messageEl.textContent =
                `${peek.essayCount} ${essayWord}${tabNote} ${peek.essayCount === 1 ? 'was' : 'were'} saved before the interruption. ` +
                `Would you like to keep them or start fresh?`;
        } else {
            titleEl.textContent = 'You have graded essays from your last session';
            messageEl.textContent =
                `${peek.essayCount} ${essayWord}${tabNote} from your previous session ${peek.essayCount === 1 ? 'was' : 'were'} auto-saved. ` +
                `What would you like to do?`;
        }

        // Show the modal. Not registered with ModalManager, so ESC and
        // backdrop click do nothing. User MUST pick a button.
        modal.style.display = 'block';

        // Wait for the user's choice via a promise that only resolves on click.
        return new Promise((resolve) => {
            const cleanup = () => {
                keepBtn.removeEventListener('click', onKeep);
                discardBtn.removeEventListener('click', onDiscard);
                modal.style.display = 'none';
            };

            const onKeep = async () => {
                cleanup();
                await loadAndRestore();
                setFormLocked(true);
                resolve(true);
            };

            const onDiscard = async () => {
                cleanup();
                await clearSavedSession();
                resolve(false);
            };

            keepBtn.addEventListener('click', onKeep);
            discardBtn.addEventListener('click', onDiscard);
        });
    }

    /**
     * Load saved session from server and restore UI.
     * Returns true if a session was restored.
     */
    /**
     * Restore a single tab's DOM state from saved data. This is the core
     * logic that was previously the body of loadAndRestore(). Now extracted
     * as a helper so it can be called once per tab in the multi-tab path.
     *
     * Assumes the target tab is already active (so activeQuery / DOM writes
     * go to the right pane) and that the tab's JS state (currentBatchData,
     * essayData, etc.) is already populated in TabStore.
     *
     * @param {Object} tabData - The saved data for this tab. In the
     *   multi-tab path this is the augmented tab snapshot from
     *   tabStoreSnapshot.tabs[i]. In the legacy path this is sessionData.
     * @param {string|null} tabId - The tab ID (for scoped queries)
     */
    function restoreTabDOM(tabData, tabId) {
        const queryInTab = (selector) => {
            if (window.TabStore && tabId) {
                return window.TabStore.queryInTab(tabId, selector);
            }
            if (window.TabStore) return window.TabStore.activeQuery(selector);
            return document.querySelector(selector);
        };

        // Render student list skeleton via displayBatchResults
        if (tabData.currentBatchData && window.BatchProcessingModule) {
            const { batchResult, originalData } = tabData.currentBatchData;
            const bData = originalData || tabData.currentBatchData.batchData;
            if (batchResult && bData) {
                window.BatchProcessingModule.displayBatchResults(batchResult, bData);
            }
        }

        // Inject saved rendered HTML (skip /format call).
        //
        // Swap-safety: each captured HTML chunk recorded which essayId it
        // belongs to (renderedHTMLEssayIds). On restore we inject it into the
        // row whose data-essay-id matches — NOT blindly by index. If a saved
        // essay failed/dropped, indices in the skeleton may not line up with
        // the saved sparse map; pairing by id guarantees a student's rendered
        // essay can only land in that student's row.
        //
        // Legacy saves (no renderedHTMLEssayIds) fall back to index injection,
        // which is safe ONLY for complete batches — see the count check below.
        if (tabData.renderedHTML) {
            const idMap = tabData.renderedHTMLEssayIds || null;

            // Legacy safety gate: a save made before essayIds existed (no idMap)
            // can only be restored by index, which is safe ONLY if the batch was
            // complete (no failed/missing essays). If a legacy save was partial,
            // index injection could slide a student's essay onto another student
            // — so we refuse to inject and leave the failure placeholders the
            // skeleton already rendered. Newer saves (with idMap) pair by id and
            // are always safe, so this gate doesn't apply to them.
            let legacyUnsafe = false;
            if (!idMap) {
                const results = tabData.currentBatchData?.batchResult?.results || [];
                const anyFailed = results.some(r => r && r.success === false);
                const renderedCount = Object.keys(tabData.renderedHTML).length;
                const successCount = results.filter(r => r && r.success).length;
                // Unsafe if any essay failed, or fewer rendered chunks than
                // successes (a gap that would slide under index injection).
                legacyUnsafe = anyFailed || (results.length > 0 && renderedCount < successCount);
                if (legacyUnsafe) {
                    console.warn('[swap-guard] legacy save (no essayIds) is partial/has failures — skipping index-based HTML restore to avoid mis-pairing; affected students show the retry placeholder');
                }
            }

            if (legacyUnsafe) {
                // Skip injection entirely; the skeleton's per-student placeholders stand.
            } else
            Object.entries(tabData.renderedHTML).forEach(([indexStr, html]) => {
                if (!html) return;
                const idx = parseInt(indexStr, 10);
                const savedEssayId = idMap ? idMap[indexStr] : null;

                let targetDiv = null;
                let targetIdx = idx;

                if (savedEssayId) {
                    // Scan all batch-essay divs in the tab for a matching data-essay-id.
                    const candidates = window.TabStore
                        ? window.TabStore.queryAllInTab(tabId, '[id^="batch-essay-"][data-essay-id]')
                        : document.querySelectorAll('[id^="batch-essay-"][data-essay-id]');
                    for (const div of candidates) {
                        if (div.dataset.essayId === savedEssayId) {
                            targetDiv = div;
                            const m = /batch-essay-(\d+)/.exec(div.id || '');
                            if (m) targetIdx = parseInt(m[1], 10);
                            break;
                        }
                    }
                    // If we had an id but found no matching row, do NOT fall back
                    // to index — that's exactly the swap we're preventing.
                    if (!targetDiv) {
                        console.warn(`[swap-guard] restore: saved essayId ${savedEssayId} has no matching row; skipping index ${idx} to avoid mis-pairing`);
                        return;
                    }
                } else {
                    // Legacy save without id map — inject by index.
                    targetDiv = queryInTab(`#batch-essay-${idx}`);
                }

                if (targetDiv) {
                    targetDiv.innerHTML = html;
                    // Pass tabId so the 250ms-delayed reattach targets the
                    // correct tab even during multi-tab restore iteration.
                    reattachHandlers(targetIdx, tabId);
                }
            });
        }

        // Inject saved highlights tab HTML.
        // NOTE: read-only back-compat for LEGACY payloads. This branch stopped
        // capturing highlightsTabHTML/highlightsContentHTML (they're regenerable
        // from the essay marks via populateHighlightsContent, and were doubling
        // the payload size this fix exists to shrink), so saves written from here
        // on never contain these fields and this block no-ops. It still fires for
        // sessions saved BEFORE the branch; absent fields just lazily regenerate.
        // Remove once old saved sessions have aged out.
        if (tabData.highlightsTabHTML) {
            Object.entries(tabData.highlightsTabHTML).forEach(([indexStr, html]) => {
                const hlTabDiv = queryInTab(`#highlights-tab-content-${indexStr}`);
                if (hlTabDiv && html) {
                    hlTabDiv.innerHTML = html;
                    hlTabDiv.dataset.loaded = 'true';
                    reattachHighlightsHandlers(parseInt(indexStr, 10), hlTabDiv, 'tab', tabId);
                }
            });
        }

        // Inject saved highlights content (grade-details section).
        // Same legacy-payload back-compat as highlightsTabHTML above — no-ops for
        // saves written from this branch on.
        if (tabData.highlightsContentHTML) {
            Object.entries(tabData.highlightsContentHTML).forEach(([indexStr, html]) => {
                const hlInner = queryInTab(`#highlights-content-${indexStr}-inner`);
                if (hlInner && html) {
                    hlInner.innerHTML = html;
                    hlInner.dataset.populated = 'true';
                    reattachHighlightsHandlers(parseInt(indexStr, 10), hlInner, 'content', tabId);
                }
            });
        }

        // Restore remove-all checkbox states
        if (tabData.removeAllStates) {
            Object.entries(tabData.removeAllStates).forEach(([contentId, checked]) => {
                if (!checked) return;
                const cbId = contentId + '-remove-all';
                const tabMatch = contentId.match(/^highlights-tab-content-(\d+)$/);
                const actualCbId = tabMatch ? `highlights-tab-${tabMatch[1]}-remove-all` : cbId;
                const cb = queryInTab(`#${actualCbId}`) || document.getElementById(actualCbId);
                if (cb) cb.checked = true;
            });
        }

        // Apply score overrides scoped to this tab. Passing tabId is critical
        // during multi-tab restore — the active tab flips between iterations
        // as switchTab is called, so activeQuery would race.
        if (tabData.scoreOverrides) {
            applyScoreOverrides(tabData.scoreOverrides, tabId);
        }

        // Restore mark-complete checkbox states
        if (tabData.completedEssays) {
            Object.entries(tabData.completedEssays).forEach(([indexStr, checked]) => {
                if (checked && window.BatchProcessingModule) {
                    window.BatchProcessingModule.markStudentComplete(parseInt(indexStr, 10), true);
                }
            });
        }
    }

    async function loadAndRestore() {
        try {
            const resp = await fetch('/api/grading-session');
            if (!resp.ok) return false;
            const data = await resp.json();
            if (!data.exists) return false;

            console.log('[AutoSave] Restoring saved session…');
            isRestoring = true;

            const { sessionData, tabStoreSnapshot } = data;

            // ─── Phase 7 multi-tab restore path ───────────────────────
            if (tabStoreSnapshot && Array.isArray(tabStoreSnapshot.tabs) && tabStoreSnapshot.tabs.length > 0) {
                console.log(`[AutoSave] Multi-tab restore: ${tabStoreSnapshot.tabs.length} tabs`);

                // 1. Deserialize TabStore state (creates tab entries, restores
                //    labels, IDs, JS state, and the ID counter). Does NOT
                //    create DOM panes — those are handled below.
                window.TabStore.deserialize(tabStoreSnapshot);

                // Track whether any tab's per-tab scoreOverrides were applied.
                // If not (e.g. loading a pre-refactor save that only has the
                // flat sessionData.scoreOverrides), we fall back after the
                // loop and apply to the primary tab.
                let appliedAnyPerTabOverrides = false;

                // 2. For each restored tab, create a DOM pane (if one doesn't
                //    already exist) and restore its DOM state.
                const allTabs = window.TabStore.all();
                for (const tabState of allTabs) {
                    const tabId = tabState.id;

                    // Tab-1's DOM pane already exists in the static HTML.
                    // For other tabs, create a new pane from the template.
                    let pane = document.querySelector(`.tab-pane[data-tab-id="${tabId}"]`);
                    if (!pane && window.TabManagementModule) {
                        // createTabPaneDOM is exposed on the module
                        if (typeof window.TabManagementModule.createTabPaneDOM === 'function') {
                            pane = window.TabManagementModule.createTabPaneDOM(tabId);
                        }
                    }

                    // Temporarily switch to this tab so displayBatchResults
                    // (called inside restoreTabDOM) writes to the correct pane.
                    if (window.TabManagementModule) {
                        window.TabManagementModule.switchTab(tabId);
                    }

                    // Wire up event handlers for the new pane
                    if (pane && window.TabManagementModule && typeof window.TabManagementModule.wireUpTabEventHandlers === 'function') {
                        window.TabManagementModule.wireUpTabEventHandlers(tabId);
                    }

                    // Find the saved data for this tab in the snapshot.
                    // tabStoreSnapshot.tabs[i] contains both the JS state AND
                    // the DOM-derived state (renderedHTML, etc.) merged by
                    // buildPayload.
                    const savedTabData = tabStoreSnapshot.tabs.find(t => t.id === tabId);
                    if (savedTabData && savedTabData.currentBatchData) {
                        // Re-populate the tab's state (deserialize only restores
                        // the core fields; essaySnapshots and DOM data are extras
                        // added by buildPayload that need to be re-applied).
                        if (savedTabData.essaySnapshots) {
                            Object.entries(savedTabData.essaySnapshots).forEach(([key, val]) => {
                                const match = key.match(/^essayData_(\d+)$/);
                                if (match) {
                                    tabState.essayData[parseInt(match[1], 10)] = val;
                                }
                            });
                        }

                        if (savedTabData.scoreOverrides
                            && Object.keys(savedTabData.scoreOverrides).length > 0) {
                            appliedAnyPerTabOverrides = true;
                        }

                        restoreTabDOM(savedTabData, tabId);
                    }
                }

                // 3. Switch to the tab that was active at save time.
                const savedActiveId = tabStoreSnapshot.activeTabId;
                if (savedActiveId && window.TabManagementModule) {
                    window.TabManagementModule.switchTab(savedActiveId);
                }

                // 4. Backward-compat fallback for pre-refactor saves: old
                //    payloads stored scoreOverrides as a flat singleton blob
                //    inside sessionData, with no per-tab gathering. If no
                //    per-tab overrides were applied above AND the legacy field
                //    is present, apply it to the primary tab as a best-effort
                //    restoration of the most-recently-setup tab's edits.
                if (!appliedAnyPerTabOverrides
                    && sessionData
                    && sessionData.scoreOverrides
                    && Object.keys(sessionData.scoreOverrides).length > 0) {
                    const primaryId = savedActiveId
                        || (tabStoreSnapshot.tabs[0] && tabStoreSnapshot.tabs[0].id)
                        || (window.TabStore && window.TabStore.activeId());
                    if (primaryId) {
                        console.log('[AutoSave] Applying legacy scoreOverrides to primary tab:', primaryId);
                        const primaryState = window.TabStore && window.TabStore.get(primaryId);
                        if (primaryState) {
                            // Seed the primary tab's batchGradingData so the next
                            // auto-save writes them in the new per-tab format.
                            primaryState.batchGradingData = JSON.parse(JSON.stringify(sessionData.scoreOverrides));
                        }
                        applyScoreOverrides(sessionData.scoreOverrides, primaryId);
                    }
                }

            // ─── Legacy single-tab restore path (pre-Phase-7 saves) ──
            } else if (sessionData) {
                console.log('[AutoSave] Legacy single-tab restore');

                const { activeTab } = data;
                if (activeTab && window.TabManagementModule) {
                    window.TabManagementModule.switchTab(activeTab);
                }

                // Populate tab-1's JS state from legacy sessionData
                const tab1State = window.TabStore && window.TabStore.active();
                if (sessionData.currentBatchData && tab1State) {
                    tab1State.currentBatchData = sessionData.currentBatchData;
                }
                if (sessionData.essaySnapshots && tab1State) {
                    Object.entries(sessionData.essaySnapshots).forEach(([key, val]) => {
                        const match = key.match(/^essayData_(\d+)$/);
                        if (match) {
                            tab1State.essayData[parseInt(match[1], 10)] = val;
                        }
                    });
                }

                restoreTabDOM(sessionData, window.TabStore ? window.TabStore.activeId() : null);
            }

            // ─── Common post-restore steps ────────────────────────────

            // Auto-resize feedback textareas that have long content
            setTimeout(() => {
                document.querySelectorAll('.editable-feedback').forEach(textarea => {
                    textarea.style.height = 'auto';
                    textarea.style.height = Math.max(34, textarea.scrollHeight) + 'px';
                });
            }, 400);

            // Restore confirmation banner. Worded to reassure: a restorable
            // session is one that was already persisted server-side, so prior
            // work is safe. (No actual save fires here — this is a load.)
            showClearButton('Session restored — all prior changes have been saved');

            // Delay clearing isRestoring until after reattachHandlers timeouts
            // and applyScoreOverrides event dispatches have settled
            setTimeout(() => {
                isRestoring = false;
                console.log('[AutoSave] Restore complete');
            }, 500);
            return true;
        } catch (err) {
            isRestoring = false;
            console.error('[AutoSave] Restore failed:', err);
            return false;
        }
    }

    /**
     * Delete saved session, reset UI to blank state.
     */
    async function clearSavedSession() {
        clearDebounce();

        // Unlock ALL tab forms and clear the grading-in-progress flag so
        // the next save doesn't re-persist a stale interrupted state.
        gradingInProgress = false;
        setFormLocked(false); // null tabId → unlocks ALL panes

        try {
            await fetch('/api/grading-session', { method: 'DELETE' });
        } catch (e) {
            console.warn('[AutoSave] Delete request failed:', e);
        }

        // Phase 7: Remove ALL extra tab panes from the DOM (keep tab-1's
        // static pane). Then call TabStore.clear() which resets the store
        // to a single fresh tab-1.
        if (window.TabStore) {
            const allTabs = window.TabStore.all();
            for (const tab of allTabs) {
                if (tab.id === 'tab-1') continue; // keep the static pane
                const pane = document.querySelector(`.tab-pane[data-tab-id="${tab.id}"]`);
                if (pane && pane.parentNode) pane.parentNode.removeChild(pane);
            }
            window.TabStore.clear(); // resets store and auto-creates a fresh tab-1
        }

        // Clear legacy window globals
        for (let i = 0; i < 50; i++) {
            if (window[`essayData_${i}`]) delete window[`essayData_${i}`];
        }
        window.currentBatchData = null;
        window.originalBatchDataForRetry = null;

        // Clear results and batch progress in ALL remaining panes
        document.querySelectorAll('.tab-pane #results, #results').forEach(div => {
            div.innerHTML = '';
            div.style.display = 'none';
        });
        document.querySelectorAll('.batch-progress-container').forEach(el => el.remove());

        // Reset ALL grading forms
        document.querySelectorAll('#gradingForm').forEach(f => f.reset());

        // Remove any toasts (the whole stack) or legacy banner
        const toastStack = document.getElementById('auto-save-toast-stack');
        if (toastStack) toastStack.remove();
        const legacyBanner = document.getElementById('auto-save-banner');
        if (legacyBanner) {
            document.body.style.paddingTop = '';
            legacyBanner.remove();
        }

        // Reset the capacity pill back to its hidden initial state — a cleared
        // session has nothing to report until the next save.
        const capChip = document.getElementById('autosaveCapacityChip');
        if (capChip) {
            capChip.hidden = true;
            capChip.classList.remove('is-ok', 'is-warn', 'is-full');
            const t = document.getElementById('autosaveCapacityChipText');
            if (t) t.textContent = 'Autosave 0%';
        }

        // Clear SingleResultModule batch data
        if (window.SingleResultModule && window.SingleResultModule.clearGradingState) {
            window.SingleResultModule.clearGradingState();
        }

        // Re-render the tab bar to reflect the cleared state (single tab)
        if (window.TabManagementModule && window.TabManagementModule.renderTabBar) {
            window.TabManagementModule.renderTabBar();
        }

        console.log('[AutoSave] Session cleared');
    }

    /**
     * Show the fixed auto-save banner at the top of the viewport.
     * Left side: status text. Right side: "Clear & Start Fresh" button.
     */
    /**
     * Show a transient toast notification at the top of the viewport.
     * Replaces the old persistent banner. Toasts auto-dismiss after a
     * delay (5s for success, stays for warnings until manually dismissed
     * or replaced by the next toast).
     *
     * @param {string} text - Message to display
     * @param {'ok'|'warn'} level - Visual style: green for ok, yellow for warn
     */
    // Toasts now STACK instead of replacing each other. Previously a new toast
    // instantly removed the old one, so the "Grading complete / capacity" banner
    // was stolen the moment the next save's "All changes saved" toast fired —
    // it flashed and vanished. Now each toast lives in a fixed stack (newest on
    // top); each self-dismisses on its own timer, and when one is removed the
    // others slide up to fill the gap (the flex column reflows automatically).

    /** Get or create the fixed-position stack that holds all toasts. */
    function getToastStack() {
        let stack = document.getElementById('auto-save-toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.id = 'auto-save-toast-stack';
            stack.style.cssText =
                'position:fixed;top:12px;left:12px;z-index:9999;' +
                'display:flex;flex-direction:column;gap:8px;' +
                'pointer-events:none;'; // wrapper ignores clicks; toasts re-enable
            document.body.appendChild(stack);
        }
        return stack;
    }

    function showToast(text, level) {
        const stack = getToastStack();

        const isWarn = level === 'warn';
        const isError = level === 'error';

        // De-dupe: if a toast with identical text is already showing, don't add
        // a second copy. This matters for persistent warnings (e.g. the same
        // capacity threshold message would otherwise re-stack on every save).
        const fullText = text + (isError ? '' : isWarn ? ' ⚠' : ' ✓');
        const dupes = stack.querySelectorAll('.auto-save-toast');
        for (const d of dupes) {
            if (d.dataset.toastText === fullText) {
                // Refresh its dismiss timer (for non-warn) so it stays the
                // expected duration from the latest trigger, then bail.
                if (d._refreshDismiss) d._refreshDismiss();
                return;
            }
        }

        let bg, border, color;
        if (isError) {
            bg = 'rgba(248,215,218,0.97)';
            border = 'rgba(180,80,80,0.5)';
            color = '#721c24';
        } else if (isWarn) {
            bg = 'rgba(255,243,205,0.95)';
            border = 'rgba(200,170,80,0.4)';
            color = '#856404';
        } else {
            bg = 'rgba(209,243,209,0.95)';
            border = 'rgba(100,180,100,0.4)';
            color = '#2d6a2d';
        }

        const toast = document.createElement('div');
        toast.className = 'auto-save-toast';
        toast.dataset.toastText = fullText;
        toast.style.cssText =
            'pointer-events:auto;' +
            'padding:10px 18px;border-radius:6px;' +
            'font-family:"Inter","Helvetica Neue",Arial,sans-serif;' +
            'font-size:13px;font-weight:500;letter-spacing:0.01em;' +
            'box-shadow:0 2px 8px rgba(0,0,0,0.12);' +
            'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
            'transition:opacity 0.3s ease;opacity:0;' +
            'white-space:pre-line;max-width:420px;' +
            `background:${bg};border:1px solid ${border};color:${color};`;
        toast.textContent = fullText;

        // Newest on top: insert at the start of the stack.
        stack.insertBefore(toast, stack.firstChild);

        // Fade in
        requestAnimationFrame(() => { toast.style.opacity = '1'; });

        const dismiss = () => {
            toast.style.opacity = '0';
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
        };

        // Auto-dismiss: 5s for success, 8s for errors (longer — users need time
        // to read a multi-line validation message). Warnings persist (no timer)
        // since they describe an ongoing condition the teacher should act on.
        let dismissTimer = null;
        if (!isWarn) {
            const dismissMs = isError ? 8000 : 5000;
            const arm = () => {
                if (dismissTimer) clearTimeout(dismissTimer);
                dismissTimer = setTimeout(dismiss, dismissMs);
            };
            arm();
            toast._refreshDismiss = arm; // used by the de-dupe path above
        }
    }

    /**
     * Legacy API: showClearButton is called by form-handling.js and
     * batch-processing.js after grading completes. In the old design it
     * created a persistent banner with a Clear button. Now it just shows
     * a brief toast confirming grading is complete.
     *
     * Autosave-capacity awareness is NOT appended here anymore — the
     * always-present capacity pill in the tab bar already shows that, so a
     * "Autosave capacity: X%" line on this banner was redundant.
     */
    function showClearButton(statusText) {
        showToast(statusText || 'Session restored', 'ok');
    }

    /**
     * Legacy API: updateBannerStatus is called by doSave and saveImmediately
     * to show save progress. Now routes to the toast.
     */
    function updateBannerStatus(text, level) {
        showToast(text, level || 'ok');
    }

    // --- Internal helpers ---

    let retryTimer = null;

    /**
     * Schedule a retry save after a failure (10s delay).
     * If the retry succeeds, the banner switches back to green.
     */
    function scheduleRetry() {
        if (retryTimer) return; // already scheduled
        retryTimer = setTimeout(() => {
            retryTimer = null;
            hasPendingChanges = true;
            doSave('retry');
        }, 10000);
    }

    function clearDebounce() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
    }

    // --- Auth-expired handling (preserve work + re-auth) ---

    /** Mirror the unsaved payload to localStorage so it survives a tab close. */
    function writePendingSaveStash(payload) {
        try {
            localStorage.setItem(PENDING_SAVE_KEY, JSON.stringify({
                savedAt: Date.now(),
                payload,
            }));
        } catch (e) {
            // localStorage can throw (quota/private mode). The in-flight memory
            // copy still covers the common case; log and continue.
            console.warn('[AutoSave] could not stash pending save to localStorage:', e && e.message);
        }
    }

    /** Remove the localStorage stash (after a successful flush or fresh save). */
    function clearPendingSaveStash() {
        try { localStorage.removeItem(PENDING_SAVE_KEY); } catch (e) { /* ignore */ }
    }

    /** Read a previously-stashed payload, if any. */
    function readPendingSaveStash() {
        try {
            const raw = localStorage.getItem(PENDING_SAVE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && parsed.payload ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Enter the auth-expired state: stop the futile retry loop, stash the
     * unsaved work durably, and prompt the user to re-authenticate. Idempotent
     * — repeated 401s won't re-prompt or re-stash redundantly.
     */
    function handleAuthExpired(payload) {
        // Always refresh the stash with the latest payload.
        if (payload) writePendingSaveStash(payload);

        if (authExpired) return; // already prompting
        authExpired = true;

        // Halt any pending retry/debounce — they would only 401 again.
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        clearDebounce();

        console.warn('[AutoSave] auth expired — halting retries, prompting re-auth');
        showReauthPrompt();
    }

    /**
     * Show a blocking re-authentication overlay. The user's work is NOT lost —
     * it's stashed locally and will be saved the moment they sign back in.
     * Passwordless login: they re-enter their email, we POST /auth/login
     * (which re-sets the session + signed cookies on this same page), then we
     * flush the stashed payload. No navigation, so the in-memory grading state
     * is preserved.
     */
    function showReauthPrompt() {
        if (document.getElementById('reauth-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'reauth-overlay';
        overlay.style.cssText =
            'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;' +
            'background:rgba(0,0,0,0.55);backdrop-filter:blur(2px);';

        const prefillEmail =
            (document.getElementById('userEmail')?.textContent || '').trim();
        const emailLooksValid = /@/.test(prefillEmail);

        overlay.innerHTML = `
            <div style="background:#fff;max-width:440px;width:90%;border-radius:10px;padding:24px;box-shadow:0 8px 30px rgba(0,0,0,0.25);font-family:'Inter',Arial,sans-serif;">
                <h2 style="margin:0 0 8px;font-size:18px;color:#2d6a2d;">Please sign back in</h2>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#333;">
                    Whoops, you've been signed out. Don't worry, your changes have been
                    saved. Please enter your email address to sign back in.
                </p>
                <input id="reauth-email" type="email" placeholder="Enter your email"
                       value="${emailLooksValid ? prefillEmail.replace(/"/g, '&quot;') : ''}"
                       style="width:100%;box-sizing:border-box;padding:10px 12px;font-size:14px;border:1px solid #ccc;border-radius:6px;margin-bottom:12px;" />
                <div id="reauth-error" style="display:none;color:#dc3545;font-size:13px;margin-bottom:10px;"></div>
                <button id="reauth-submit"
                        style="width:100%;padding:10px;font-size:15px;font-weight:600;background:#007bff;color:#fff;border:none;border-radius:6px;cursor:pointer;">
                    Sign back in
                </button>
            </div>`;
        document.body.appendChild(overlay);

        const emailInput = overlay.querySelector('#reauth-email');
        const submitBtn = overlay.querySelector('#reauth-submit');
        const errEl = overlay.querySelector('#reauth-error');
        emailInput.focus();

        const submit = async () => {
            const email = (emailInput.value || '').trim();
            if (!/@/.test(email)) {
                errEl.textContent = 'Please enter a valid email address.';
                errEl.style.display = 'block';
                return;
            }
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in…';
            errEl.style.display = 'none';
            const ok = await attemptReauth(email);
            if (ok) {
                overlay.remove();
            } else {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign back in';
                errEl.textContent = 'That didn’t work. Please check your email and try again.';
                errEl.style.display = 'block';
            }
        };
        submitBtn.addEventListener('click', submit);
        emailInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    }

    /**
     * Re-authenticate in place via the passwordless login endpoint. On success
     * the server re-sets the session + signed cookies, so subsequent saves are
     * authorized. Returns true on success.
     */
    async function attemptReauth(email) {
        try {
            const resp = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            if (!resp.ok) {
                console.warn('[AutoSave] re-auth failed:', resp.status);
                return false;
            }
            console.log('[AutoSave] re-auth successful — flushing stashed work');
            authExpired = false;
            await flushPendingSave();
            return true;
        } catch (e) {
            console.warn('[AutoSave] re-auth error:', e && e.message);
            return false;
        }
    }

    /**
     * After re-auth, save the user's work. We prefer the CURRENT in-memory
     * state (most up to date), falling back to the localStorage stash if the
     * live payload can't be built. Clears the stash on success.
     */
    async function flushPendingSave() {
        let payload = buildPayload();
        if (!payload) {
            const stash = readPendingSaveStash();
            payload = stash && stash.payload;
        }
        if (!payload) {
            clearPendingSaveStash();
            updateBannerStatus('You’re back in — everything’s saved', 'ok');
            return;
        }
        try {
            const resp = await fetch('/api/grading-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (resp.ok) {
                lastSuccessfulSaveTime = Date.now();
                hasPendingChanges = false;
                clearPendingSaveStash();
                updateBannerStatus('All changes saved', 'ok');
                console.log('[AutoSave] stashed work flushed successfully after re-auth');
            } else if (resp.status === 401 || resp.status === 403) {
                // Still unauthorized — re-prompt (stash retained).
                authExpired = false; // allow handleAuthExpired to re-enter
                handleAuthExpired(payload);
            } else {
                updateBannerStatus('You’re back in. Still saving — please keep this page open…', 'warn');
                scheduleRetry();
            }
        } catch (e) {
            updateBannerStatus('You’re back in. Still saving — please keep this page open…', 'warn');
            scheduleRetry();
        }
    }

    /**
     * Look up essay data by index. Prefers the batch's originating tab
     * when a batch is currently streaming (via BatchProcessingModule
     * batch tab context), else the active tab, else the legacy window
     * global. This mirrors the tab-resolution logic in buildPayload so
     * save / restore always reads the right tab.
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
     * Count how many essayData entries exist (scan up to 50).
     * Returns highest filled index + 1, so the iteration range in buildPayload
     * spans the full batch even when failed essays leave gaps in the sequence
     * (batch-processing.js only sets essayData for essay.success === true).
     */
    function countEssayDataGlobals() {
        let highestIndex = -1;
        for (let i = 0; i < 50; i++) {
            if (readEssayData(i)) highestIndex = i;
        }
        return highestIndex + 1;
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
            gradingInProgress,
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

    /**
     * Current autosave capacity as a percent of the ceiling (0–100+, clamped at
     * display time). 100% = the hard stop. Exposed for the grading-complete
     * banner.
     */
    function getCapacityPercent() {
        return Math.round((lastPayloadBytes / PAYLOAD_CEILING_BYTES) * 100);
    }

    /**
     * Measure the serialized payload against the budget, update the persistent
     * capacity chip, fire escalating warnings on upward threshold crossings, and
     * flip the edit-block at the ceiling. Byte length is measured as UTF-8 (what
     * actually travels on the wire), not string length.
     * @param {string} body - the JSON.stringify'd payload
     */
    function evaluatePayloadBudget(body) {
        let bytes;
        try {
            bytes = (typeof TextEncoder !== 'undefined')
                ? new TextEncoder().encode(body).length
                : body.length; // fallback: approx (ASCII-ish)
        } catch (e) {
            bytes = body.length;
        }
        lastPayloadBytes = bytes;
        const pct = getCapacityPercent();

        // Update the persistent chip every save.
        updateCapacityChip(pct);

        if (bytes >= PAYLOAD_CEILING_BYTES) {
            // At/over the ceiling — block payload-growing edits.
            if (!payloadOverBudget) {
                payloadOverBudget = true;
                showToast(
                    'Autosave is full (100%). New highlights can’t be saved.\n' +
                    'Download (PDF) the essays you want, then clear a finished tab ' +
                    'or start a fresh session for the rest.',
                    'error'
                );
            }
        } else {
            // Back under the ceiling (e.g. a tab was cleared) — re-enable edits.
            if (payloadOverBudget) {
                payloadOverBudget = false;
                showToast('Autosave is back under capacity — you can add highlights again.', 'ok');
            }
            // Escalating threshold toasts. Fire only when crossing UP into a
            // higher bucket than the highest one we've already warned at. To
            // avoid spam when the payload jitters a hair around a boundary
            // (saves vary ±~1% save-to-save), we only RE-ARM a bucket once
            // capacity has dropped a clear margin (HYSTERESIS) below its
            // threshold — i.e. the teacher actually freed space (cleared a tab),
            // not just noise.
            const HYSTERESIS = 3; // percentage points
            let bucket = -1;
            for (let i = 0; i < CAPACITY_THRESHOLDS.length; i++) {
                if (pct >= CAPACITY_THRESHOLDS[i].pct) bucket = i;
            }
            if (bucket > lastCapacityBucket) {
                const t = CAPACITY_THRESHOLDS[bucket];
                showToast(t.msg.replace('{P}', String(pct)), t.level);
                lastCapacityBucket = bucket;
            } else if (bucket < lastCapacityBucket) {
                // Only step the armed level down past a threshold the payload has
                // dropped clearly below — so re-entry must be a genuine re-climb.
                while (lastCapacityBucket >= 0 &&
                       pct < CAPACITY_THRESHOLDS[lastCapacityBucket].pct - HYSTERESIS) {
                    lastCapacityBucket--;
                }
            }
            // (equal bucket → do nothing: no re-fire, no re-arm)
        }

        console.log(`[AutoSave] payload size: ${(bytes / 1_000_000).toFixed(2)}MB ` +
            `(${pct}% of ceiling ${(PAYLOAD_CEILING_BYTES / 1_000_000).toFixed(1)}MB, overBudget=${payloadOverBudget})`);
    }

    /**
     * Measure current capacity and reveal the pill WITHOUT performing a network
     * save. Used on page load so a restored session shows its capacity right
     * away, instead of the pill staying hidden until the user's first edit (the
     * old behavior — the chip only updated inside doSave()). Skips entirely when
     * there's no real grading content yet, so an empty fresh form doesn't show a
     * "0%" pill until there's actually something to report.
     */
    function refreshCapacityDisplay() {
        const payload = buildPayload();
        if (!payloadHasResults(payload)) return; // nothing graded yet — keep the pill hidden
        evaluatePayloadBudget(JSON.stringify(payload));
    }

    /**
     * Update the always-present "Autosave N%" capacity pill anchored to the
     * RIGHT edge of the tab bar (markup in index.html: #autosaveCapacityChip).
     * Color shifts green → amber → red as capacity climbs; at 90%+ it appends a
     * short action hint. Hidden until there's something to report — revealed on
     * page load for a restored session (refreshCapacityDisplay) or on the first
     * save, whichever comes first.
     *
     * The pill is a permanent sibling of the .tab-list lane, so renderTabBar()
     * — which rewrites only .tab-list's innerHTML — never destroys it. CSS
     * pins it right and forbids it from shrinking, and caps the tab lane to the
     * space left of it, so tabs compress to fit instead of pushing the pill
     * around or off-screen (the old "weird things with multiple tabs").
     * @param {number} pct
     */
    function updateCapacityChip(pct) {
        try {
            const chip = document.getElementById('autosaveCapacityChip');
            const textEl = document.getElementById('autosaveCapacityChipText');
            if (!chip || !textEl) return;

            const clamped = Math.min(100, Math.max(0, pct));

            // Reveal on first real measurement.
            if (chip.hidden) chip.hidden = false;

            // Color band → CSS class.
            chip.classList.remove('is-ok', 'is-warn', 'is-full');
            if (clamped < 70) chip.classList.add('is-ok');
            else if (clamped < 90) chip.classList.add('is-warn');
            else chip.classList.add('is-full');

            const hint = clamped >= 90 ? ' — clear a tab' : '';
            textEl.textContent = `Autosave ${clamped}%${hint}`;
        } catch (e) {
            // Cosmetic only — never let the chip break saving.
            console.warn('[AutoSave] capacity chip update skipped:', e && e.message);
        }
    }

    /**
     * Whether the current session payload is at/over the size ceiling. Edit
     * handlers that would GROW the payload (new highlights, comment/note text)
     * consult this to block themselves, so the teacher never makes changes that
     * would silently fail to save. Returns false if AutoSave isn't active.
     */
    function isPayloadOverBudget() {
        return payloadOverBudget === true;
    }

    /**
     * Execute a save if not already saving.
     * @param {string} source - Label identifying the caller (for diagnostics).
     */
    async function doSave(source) {
        source = source || 'unknown';
        if (isSaving || isRestoring) {
            console.log(`[AutoSaveDiag] doSave[${source}]: skipped (isSaving=${isSaving}, isRestoring=${isRestoring})`);
            return;
        }
        // While auth is expired, do not hit the server — every request would
        // 401. We keep the latest payload stashed (updated below) so the user
        // can keep editing; the stash flushes once they re-authenticate.
        if (authExpired) {
            const pending = buildPayload();
            if (pending) writePendingSaveStash(pending);
            console.log(`[AutoSaveDiag] doSave[${source}]: skipped (auth expired) — work stashed locally`);
            return;
        }
        const payload = buildPayload();
        if (!payload) {
            console.log(`[AutoSaveDiag] doSave[${source}]: no payload to save`);
            return;
        }

        // Serialize once; reuse for both the size check and the request body.
        const body = JSON.stringify(payload);
        evaluatePayloadBudget(body);

        isSaving = true;
        try {
            console.log(`[AutoSave] Saving session via ${source}…`);
            const resp = await fetch('/api/grading-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });
            if (resp.status === 401 || resp.status === 403) {
                // Auth lapsed. Retrying is pointless — the same credentials
                // will 401 every time. Stash the work and prompt re-auth.
                console.warn('[AutoSave] Save rejected (auth expired):', resp.status);
                handleAuthExpired(payload);
            } else if (!resp.ok) {
                console.warn('[AutoSave] Save failed:', resp.status);
                updateBannerStatus('Couldn’t save just now — please keep this page open while we try again.', 'warn');
                scheduleRetry();
            } else {
                console.log('[AutoSave] Save successful');
                lastSuccessfulSaveTime = Date.now();
                hasPendingChanges = false;
                // A successful save means auth is healthy; clear any stash.
                clearPendingSaveStash();
                updateBannerStatus('All changes saved', 'ok');
            }
        } catch (err) {
            console.warn('[AutoSave] Save error:', err);
            updateBannerStatus('Couldn’t save just now — please keep this page open while we try again.', 'warn');
            scheduleRetry();
        } finally {
            isSaving = false;
        }
    }

    /**
     * Re-attach interactive handlers on a restored essay div.
     *
     * @param {number} index - Essay index
     * @param {string|null} tabId - The tab ID to scope queries to. During
     *   multi-tab restore, the active tab changes as we iterate, so callers
     *   pass the specific tab ID to avoid the 250ms setTimeout finding the
     *   wrong tab's elements.
     */
    function reattachHandlers(index, tabId) {
        // Capture the tab ID now; by the time the setTimeout fires, the
        // active tab may have changed (multi-tab restore iterates tabs).
        const scopedTabId = tabId
            || (window.TabStore && window.TabStore.activeId())
            || null;

        const queryScoped = (selector) => {
            if (window.TabStore && scopedTabId) {
                return window.TabStore.queryInTab(scopedTabId, selector);
            }
            if (window.TabStore) return window.TabStore.activeQuery(selector);
            return document.querySelector(selector);
        };

        const queryAllScoped = (selector) => {
            if (window.TabStore && scopedTabId) {
                return window.TabStore.queryAllInTab(scopedTabId, selector);
            }
            return document.querySelectorAll(selector);
        };

        setTimeout(() => {
            const essayData = readEssayData(index);
            if (!essayData) return;
            const { essay, originalData } = essayData;

            // Strip "already initialized" data attributes from injected HTML.
            // Event listeners don't survive innerHTML injection, but these marker
            // attributes do — causing setup functions to skip re-attaching listeners.
            const essayContainer = queryScoped(`#batch-essay-${index}`);
            if (essayContainer) {
                essayContainer.removeAttribute('data-listeners-attached');
                essayContainer.querySelectorAll('[data-listener-added]').forEach(
                    el => el.removeAttribute('data-listener-added')
                );
                essayContainer.querySelectorAll('[data-listener-setup]').forEach(
                    el => el.removeAttribute('data-listener-setup')
                );
            }

            // Text selection handler
            const essayContentDiv = queryScoped(`.formatted-essay-content[data-essay-index="${index}"]`);
            if (essayContentDiv) {
                essayContentDiv.addEventListener('mouseup', function (e) {
                    const selection = window.getSelection();
                    const hasTextSelection =
                        selection.rangeCount > 0 && !selection.isCollapsed;
                    if (hasTextSelection) {
                        if (window.TextSelectionModule) {
                            window.TextSelectionModule.handleBatchTextSelection(e, index);
                        }
                        return;
                    }
                    if (e.target.tagName === 'SPAN' || e.target.tagName === 'MARK') return;
                    const highlightParent = e.target.closest(
                        'span[data-category], mark[data-category]'
                    );
                    if (highlightParent) return;
                    if (window.TextSelectionModule) {
                        window.TextSelectionModule.handleBatchTextSelection(e, index);
                    }
                });
            }

            // The restored HTML is a saved snapshot that may carry stale category
            // labels/order in the button row and the "Highlight Meanings" key.
            // Rebuild both from the current single source of truth so previously-
            // saved essays reflect the latest categories. The essay's highlight
            // marks (the real data) are untouched; their colors come from the
            // generated categories.css regardless of the saved inline styles.
            const categoryButtonsContainer = queryScoped(`#categoryButtons-${index}`);
            if (categoryButtonsContainer && window.CategorySelectionModule &&
                typeof window.CategorySelectionModule.createCategoryButtons === 'function') {
                categoryButtonsContainer.innerHTML =
                    window.CategorySelectionModule.createCategoryButtons(index) +
                    `<button id="clearSelectionBtn-${index}" onclick="clearSelection(${index})" style="background: #f5f5f5; color: #666; border: 2px solid #ccc; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-left: 10px;">Clear Selection</button>`;
            }

            // Rebuild the "Highlight Meanings" legend from the source of truth.
            // The legend lives inside the restored #batch-essay-N subtree.
            if (essayContainer && typeof createColorLegend === 'function') {
                const oldLegend = essayContainer.querySelector('.color-legend');
                if (oldLegend) {
                    const tmp = document.createElement('div');
                    tmp.innerHTML = createColorLegend();
                    const fresh = tmp.querySelector('.color-legend');
                    if (fresh) oldLegend.replaceWith(fresh);
                }
            }

            // Category buttons
            const categoryButtons = queryAllScoped(
                `#categoryButtons-${index} .category-btn`
            );
            categoryButtons.forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    const category = this.dataset.category;
                    if (window.CategorySelectionModule) {
                        window.CategorySelectionModule.selectBatchCategory(category, index);
                    } else if (window.TextSelectionModule) {
                        window.TextSelectionModule.setSelectedCategory(category, index);
                    }
                });
            });

            // Highlight click handlers
            if (window.HighlightingModule) {
                if (essayContainer) {
                    const highlights = essayContainer.querySelectorAll(
                        'span[style*="background"], span[class*="highlight"], span[style*="color"], mark[data-type], mark.highlighted-segment, mark[data-category]'
                    );
                    highlights.forEach(function (element) {
                        element.style.cursor = 'pointer';
                        element.addEventListener(
                            'click',
                            function (e) {
                                e.stopPropagation();
                                e.preventDefault();
                                if (window.HighlightingModule) {
                                    window.HighlightingModule.editHighlight(this);
                                }
                            },
                            true
                        );
                        element.addEventListener(
                            'mousedown',
                            function (e) {
                                e.stopPropagation();
                            },
                            true
                        );
                    });
                    window.HighlightingModule.ensureHighlightClickHandlers(essayContainer);
                }
            }

            // Essay editing module
            if (window.EssayEditingModule && essay && originalData) {
                window.EssayEditingModule.initializeBatchEssayEditing(
                    index,
                    essay.result,
                    originalData
                );
            }

            // Editable score inputs (also calls setupCategoryNoteToggleListeners internally).
            // Pass scopedTabId so per-tab batchGradingData writes land in the
            // correct tab even though the active tab may have changed during
            // the 250ms setTimeout (multi-tab restore iterates tabs).
            if (
                window.SingleResultModule &&
                window.SingleResultModule.setupBatchEditableElements &&
                essay &&
                originalData
            ) {
                window.SingleResultModule.setupBatchEditableElements(
                    essay.result,
                    originalData,
                    index,
                    scopedTabId
                );
            }

            // Highlight PDF toggle listeners (for the highlights management tab)
            if (essayContainer && window.DisplayUtilsModule &&
                window.DisplayUtilsModule.setupTogglePDFListeners) {
                window.DisplayUtilsModule.setupTogglePDFListeners(essayContainer);
            }

            // Auto-resize feedback textareas to fit their content
            if (essayContainer) {
                essayContainer.querySelectorAll('.editable-feedback').forEach(textarea => {
                    textarea.style.height = 'auto';
                    textarea.style.height = Math.max(34, textarea.scrollHeight) + 'px';
                });
            }
        }, 250);
    }

    /**
     * Re-attach interactive handlers on a restored highlights section.
     * @param {number} index - Essay index
     * @param {HTMLElement} container - The highlights content container
     * @param {'tab'|'content'} type - Which highlights section this is
     * @param {string|null} tabId - Tab to scope queries to (for multi-tab restore)
     */
    function reattachHighlightsHandlers(index, container, type, tabId) {
        const scopedTabId = tabId
            || (window.TabStore && window.TabStore.activeId())
            || null;

        setTimeout(() => {
            // Strip guard attributes that survived innerHTML injection
            container.querySelectorAll('[data-setup-complete]').forEach(
                el => el.removeAttribute('data-setup-complete')
            );

            // Setup toggle PDF button listeners
            if (window.DisplayUtilsModule && window.DisplayUtilsModule.setupTogglePDFListeners) {
                window.DisplayUtilsModule.setupTogglePDFListeners(container);
            }

            // Setup remove-all checkbox
            if (type === 'tab') {
                const checkbox = (window.TabStore && scopedTabId)
                    ? window.TabStore.queryInTab(scopedTabId, `#highlights-tab-${index}-remove-all`)
                    : document.getElementById(`highlights-tab-${index}-remove-all`);
                if (checkbox) {
                    checkbox.removeAttribute('data-setup-complete');
                    // setupRemoveAllCheckboxForTab is declared at global scope in grading-display-main.js
                    if (window.setupRemoveAllCheckboxForTab) {
                        window.setupRemoveAllCheckboxForTab(checkbox, container);
                    } else {
                        setupRemoveAllCheckboxFromAutoSave(checkbox, container);
                    }
                }
            } else if (type === 'content') {
                const contentId = `highlights-content-${index}`;
                const checkbox = document.getElementById(`${contentId}-remove-all`);
                if (checkbox) {
                    checkbox.removeAttribute('data-setup-complete');
                    if (window.DisplayUtilsModule && window.DisplayUtilsModule.setupRemoveAllCheckbox) {
                        window.DisplayUtilsModule.setupRemoveAllCheckbox(contentId);
                    }
                }
            }
        }, 250);
    }

    /**
     * Setup remove-all checkbox listener for highlights tab (mirrors setupRemoveAllCheckboxForTab
     * from grading-display-main.js, which is a file-scoped function we can't call directly).
     */
    function setupRemoveAllCheckboxFromAutoSave(checkbox, contentDiv) {
        if (checkbox.dataset.setupComplete === 'true') return;

        const contentId = checkbox.dataset.contentId || checkbox.id.replace('-remove-all', '');
        const savedState = localStorage.getItem(`removeAllFromPDF_${contentId}`);

        let isChecked;
        if (savedState !== null) {
            isChecked = savedState === 'true';
            checkbox.checked = isChecked;
        } else {
            isChecked = checkbox.checked;
        }

        // Apply state to all toggle buttons
        if (isChecked) {
            const toggleButtons = contentDiv.querySelectorAll('.toggle-pdf-btn');
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
            const checked = this.checked;
            localStorage.setItem(`removeAllFromPDF_${contentId}`, checked.toString());
            const toggleButtons = contentDiv.querySelectorAll('.toggle-pdf-btn');
            toggleButtons.forEach(button => {
                const elementId = button.dataset.elementId;
                const highlightElement = document.getElementById(elementId);
                if (!highlightElement) return;
                highlightElement.dataset.excludeFromPdf = checked ? 'true' : 'false';
                button.dataset.excluded = checked;
                if (checked) {
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
                const entryDiv = button.closest('div[style*="margin: 20px 0"]');
                if (entryDiv) {
                    entryDiv.style.textDecoration = checked ? 'line-through' : 'none';
                    entryDiv.style.opacity = checked ? '0.6' : '1';
                }
            });
        });

        checkbox.dataset.setupComplete = 'true';
    }

    /**
     * Apply saved score overrides to the DOM inputs.
     * @param {Object} overrides - Score overrides keyed by essay index.
     * @param {string} [tabId] - Optional tab ID. When provided, container lookups
     *                          are scoped to that tab's pane via queryInTab,
     *                          which is critical during the multi-tab restore
     *                          loop where the active tab flips between iterations.
     */
    function applyScoreOverrides(overrides, tabId) {
        if (!overrides) return;

        Object.entries(overrides).forEach(([essayIndex, data]) => {
            if (!data || !data.gradingData || !data.gradingData.scores) return;

            Object.entries(data.gradingData.scores).forEach(([category, scoreData]) => {
                // Find score input for this essay/category, scoped to the
                // target tab (not the active tab).
                const container = (window.TabStore && tabId)
                    ? window.TabStore.queryInTab(tabId, `#batch-essay-${essayIndex}`)
                    : (window.TabStore
                        ? window.TabStore.activeQuery(`#batch-essay-${essayIndex}`)
                        : document.getElementById(`batch-essay-${essayIndex}`));
                if (!container) return;

                const input = container.querySelector(
                    `.score-input[data-category="${category}"], .editable-score[data-category="${category}"]`
                );
                if (input && scoreData.points !== undefined) {
                    input.value = scoreData.points;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }

                // Find feedback textarea
                const textarea = container.querySelector(
                    `.editable-feedback[data-category="${category}"]`
                );
                if (textarea && scoreData.rationale !== undefined) {
                    textarea.value = scoreData.rationale;
                }
            });
        });
    }

    // --- Expose ---
    window.AutoSaveModule = {
        initialize,
        saveImmediately,
        debouncedSave,
        loadAndRestore,
        promptRestoreIfSaved,
        clearSavedSession,
        showClearButton,
        setFormLocked,
        markGradingStarted,
        markGradingFinished,
        isGradingInProgress,
        // True while a saved session is being restored/re-rendered. Lets the
        // re-render path (displayBatchResults) suppress its "Grading complete"
        // banner during restore — restore shows its own banner instead.
        isRestoring: () => isRestoring,
        // Consulted by edit handlers that would grow the payload (new
        // highlights, comment/note text) so they can block themselves when the
        // session is at the size ceiling. See evaluatePayloadBudget.
        isPayloadOverBudget,
        // Current autosave capacity as a percent of the ceiling — used by the
        // grading-complete banner to show ambient capacity awareness.
        getCapacityPercent,
        // Exposed so other modules (e.g. form validation) can surface
        // toast-style messages with consistent styling. Levels: 'ok' (green,
        // 5s), 'warn' (yellow, persistent), 'error' (red, 8s).
        showToast,
    };
})();
