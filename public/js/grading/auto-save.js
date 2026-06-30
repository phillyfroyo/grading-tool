/**
 * Auto-Save Module
 * Persists grading session data to the database so results survive page reloads.
 * Exposes window.AutoSaveModule.
 *
 * ── CLUSTER MAP (concern groups; this file is large and a structured split is
 *    planned — see HANDOFF-413-fix.md. Until then, use this map to navigate.) ──
 *   A. Save lifecycle ....... saveImmediately, debouncedSave, doSave, scheduleRetry, clearDebounce
 *   B. Payload build/de-dup .. EXTRACTED to auto-save-payload.js (window.AutoSavePayload):
 *                              buildPayload, gatherTabDOMState, readEssayData, payloadHasResults.
 *                              Thin local wrappers here delegate to it; internal-only (no facade
 *                              members). Seam: reads gradingInProgress via AutoSaveGrading getter.
 *                              (countEssayDataGlobals was dead — deleted in the move.)
 *   C. Restore & reattach .... peekSavedSession, promptRestoreIfSaved, loadAndRestore,
 *      (HIGHEST RISK)          restoreTabDOM, reattachHandlers, reattachHighlightsHandlers,
 *                              setupRemoveAllCheckboxFromAutoSave, applyScoreOverrides
 *   D. Capacity / budget ..... EXTRACTED to auto-save-capacity.js (window.AutoSaveCapacity):
 *                              evaluatePayloadBudget, getCapacityPercent, refreshCapacityDisplay,
 *                              updateCapacityChip, isPayloadOverBudget. Thin local wrappers here
 *                              delegate. Outbound seams to AutoSaveUI (banner) + AutoSavePayload.
 *   E. Toasts / banners ...... EXTRACTED to auto-save-ui.js (window.AutoSaveUI).
 *                              Thin local wrappers here delegate to it: showToast,
 *                              showClearButton, updateBannerStatus, updateSaveStatus,
 *                              updateCapacityBanner. Seam: resetFullDismissed().
 *   F. Auth-expiry & stash ... write/clear/readPendingSaveStash, recoverOrphanedStash,
 *                              handleAuthExpired, showReauthPrompt, attemptReauth, flushPendingSave
 *   G. Grading-state & lock .. EXTRACTED to auto-save-grading.js (window.AutoSaveGrading):
 *                              markGradingStarted/Finished, isGradingInProgress, setFormLocked.
 *                              Thin local wrappers here delegate to it; seam:
 *                              setGradingInProgress() (core teardown clears the flag).
 *                              clearSavedSession stays here (cross-cluster teardown orchestrator).
 *   H. Wiring ................ initialize
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
    // Grading-state + form lock (Cluster G) live in auto-save-grading.js
    // (window.AutoSaveGrading). The gradingInProgress flag moved there too;
    // the core reads it via isGradingInProgress() and clears it on teardown via
    // setGradingInProgress(false). Thin local wrappers below delegate the rest.
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
    // The budget state (ceiling, last bytes, over-budget flag) + the capacity
    // functions live in auto-save-capacity.js (window.AutoSaveCapacity). Thin
    // local wrappers below delegate to it. Capacity guidance shows via the single
    // self-updating banner (AutoSaveUI.updateCapacityBanner): one element, live %,
    // warn at 70%+, full at 100%+.

    // Banner/toast UI (Cluster E) lives in auto-save-ui.js (window.AutoSaveUI).
    // Its state — the save-status dismiss timer and the capacity-banner dismissal
    // flags — moved there too. The thin local wrappers below delegate to it; the
    // one piece of state the core touches is re-armed via AutoSaveUI.resetFullDismissed().

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

    // payloadHasResults (Cluster B) — thin delegator to auto-save-payload.js.
    function payloadHasResults(payload) {
        return !!(window.AutoSavePayload
            && window.AutoSavePayload.payloadHasResults(payload));
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
            updateSaveStatus('Saving\u2026', 'pending');
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

    // --- Cluster G (grading-state + form lock) — thin delegators to auto-save-grading.js ---
    // The implementations live in window.AutoSaveGrading (loaded before this file).
    // These local wrappers keep the core's internal call sites + public facade unchanged.

    function markGradingStarted() {
        if (window.AutoSaveGrading) window.AutoSaveGrading.markGradingStarted();
    }

    function markGradingFinished() {
        if (window.AutoSaveGrading) window.AutoSaveGrading.markGradingFinished();
    }

    function isGradingInProgress() {
        return !!(window.AutoSaveGrading && window.AutoSaveGrading.isGradingInProgress());
    }

    function setFormLocked(locked, tabId) {
        if (window.AutoSaveGrading) window.AutoSaveGrading.setFormLocked(locked, tabId);
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

        // Restore remove-all checkbox states.
        // The checkbox now lives INSIDE the (lazily-rendered) highlights dropdown
        // body, so on restore it usually doesn't exist yet — when the teacher
        // opens the dropdown it's generated already-checked from localStorage.
        // So we persist the saved state to localStorage here (the durable source
        // of truth that export reads via applyRemoveAllStateToMarks), which also
        // covers a fresh-browser restore where localStorage started empty. If the
        // checkbox happens to already be in the DOM, reflect it too.
        if (tabData.removeAllStates) {
            Object.entries(tabData.removeAllStates).forEach(([contentId, checked]) => {
                if (!checked) return;
                // Tab-scoped key. CRITICAL: pass the EXPLICIT tabId of the tab
                // being restored — during multi-tab restore the active tab flips,
                // so activeId() would mis-scope this to the wrong tab.
                const key = window.removeAllStorageKey
                    ? window.removeAllStorageKey(contentId, tabId)
                    : `removeAllFromPDF_${contentId}`;
                localStorage.setItem(key, 'true');
                const actualCbId = window.removeAllCheckboxId
                    ? window.removeAllCheckboxId(contentId)
                    : `${contentId}-remove-all`;
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

            // Restore confirmation banner. Kept terse: the "all prior changes
            // saved" wording was dropped because the save-status banner that
            // appears just after restore already conveys that, so the two read
            // as redundant. (No actual save fires here — this is a load.)
            showClearButton('Session restored');

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
        // the next save doesn't re-persist a stale interrupted state. The flag
        // now lives in auto-save-grading.js — clear it via its seam setter.
        if (window.AutoSaveGrading) window.AutoSaveGrading.setGradingInProgress(false);
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

    // --- Cluster E (toasts / banners UI) — thin delegators to auto-save-ui.js ---
    // The implementations live in window.AutoSaveUI (loaded before this file).
    // These local wrappers keep the core's internal call sites unchanged.

    function showToast(text, level) {
        if (window.AutoSaveUI) window.AutoSaveUI.showToast(text, level);
    }

    function showClearButton(statusText) {
        if (window.AutoSaveUI) window.AutoSaveUI.showClearButton(statusText);
    }

    function updateBannerStatus(text, level) {
        if (window.AutoSaveUI) window.AutoSaveUI.updateBannerStatus(text, level);
    }

    function updateSaveStatus(text, state) {
        if (window.AutoSaveUI) window.AutoSaveUI.updateSaveStatus(text, state);
    }

    function updateCapacityBanner(pct) {
        if (window.AutoSaveUI) window.AutoSaveUI.updateCapacityBanner(pct);
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
                updateSaveStatus('All changes saved', 'ok');
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

    // --- Cluster B (payload build/de-dup) — thin delegators to auto-save-payload.js ---
    // Implementations live in window.AutoSavePayload (loaded before this file).
    // (countEssayDataGlobals was dead — zero callers — and was dropped in the move.)

    function readEssayData(index) {
        return window.AutoSavePayload && window.AutoSavePayload.readEssayData(index);
    }

    function gatherTabDOMState(tabId, tabState, omitHTML) {
        return window.AutoSavePayload
            && window.AutoSavePayload.gatherTabDOMState(tabId, tabState, omitHTML);
    }

    function buildPayload(omitHTML) {
        return window.AutoSavePayload
            ? window.AutoSavePayload.buildPayload(omitHTML)
            : null;
    }

    // --- Cluster D (capacity/budget) — thin delegators to auto-save-capacity.js ---
    // Implementations + state live in window.AutoSaveCapacity (loaded before this file).

    function getCapacityPercent() {
        return window.AutoSaveCapacity ? window.AutoSaveCapacity.getCapacityPercent() : 0;
    }

    function evaluatePayloadBudget(body) {
        if (window.AutoSaveCapacity) window.AutoSaveCapacity.evaluatePayloadBudget(body);
    }

    function refreshCapacityDisplay() {
        if (window.AutoSaveCapacity) window.AutoSaveCapacity.refreshCapacityDisplay();
    }

    function updateCapacityChip(pct) {
        if (window.AutoSaveCapacity) window.AutoSaveCapacity.updateCapacityChip(pct);
    }

    function isPayloadOverBudget() {
        return !!(window.AutoSaveCapacity && window.AutoSaveCapacity.isPayloadOverBudget());
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
                updateSaveStatus('Couldn’t save just now — please keep this page open while we try again.', 'warn');
                scheduleRetry();
            } else {
                console.log('[AutoSave] Save successful');
                lastSuccessfulSaveTime = Date.now();
                hasPendingChanges = false;
                // A successful save means auth is healthy; clear any stash.
                clearPendingSaveStash();
                updateSaveStatus('All changes saved', 'ok');
            }
        } catch (err) {
            console.warn('[AutoSave] Save error:', err);
            updateSaveStatus('Couldn’t save just now — please keep this page open while we try again.', 'warn');
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
            // attributes do — causing setup functions to skip re-attaching the
            // per-element listeners that are still attached that way (the score
            // INPUTs via data-listener-added, the container guard via
            // data-listeners-attached). The arrow steppers, note PDF toggle, and
            // new-highlight mouseup are now document-delegated and need no strip.
            const essayContainer = queryScoped(`#batch-essay-${index}`);
            if (essayContainer) {
                essayContainer.removeAttribute('data-listeners-attached');
                essayContainer.querySelectorAll('[data-listener-added]').forEach(
                    el => el.removeAttribute('data-listener-added')
                );
                // Heal contaminated saves: a cross-tab bug (fixed in highlighting.js)
                // could brand a teacher-note span as a highlight, and that branding
                // is persisted in renderedHTML and replays here on restore. Strip it
                // off this tab's note spans (scoped to essayContainer). Source is now
                // fixed; this undoes prior damage so reloaded sessions self-clean.
                if (window.EditingFunctionsModule && window.EditingFunctionsModule.sanitizeTeacherNoteSpan) {
                    essayContainer.querySelectorAll('.teacher-notes-content').forEach(
                        span => window.EditingFunctionsModule.sanitizeTeacherNoteSpan(span)
                    );
                }
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
                    // Wire legacy/GPT highlight spans via the shared helper (the
                    // broad selector + .teacher-notes guard + capture-phase
                    // listeners live in highlighting.js, shared with the
                    // initial-render path in batch-processing.js so they can't
                    // drift). Restore doesn't re-brand: the saved HTML already
                    // carries data-category/title, so brandCategory is omitted.
                    window.HighlightingModule.wireLegacyHighlightSpans(essayContainer);
                    // Scope to the color-coded essay, NOT the whole #batch-essay-N
                    // row — the row also contains the teacher-notes block, and the
                    // un-scoped call would re-wire note descendants as highlights.
                    const essayContentForHandlers = queryScoped(`.formatted-essay-content[data-essay-index="${index}"]`) || essayContainer;
                    window.HighlightingModule.ensureHighlightClickHandlers(essayContentForHandlers);
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

            // Editable score inputs. Pass scopedTabId so per-tab batchGradingData
            // writes land in the correct tab even though the active tab may have
            // changed during the 250ms setTimeout (multi-tab restore iterates tabs).
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
                        setupRemoveAllCheckboxFromAutoSave(checkbox, container, scopedTabId);
                    }
                }
            } else if (type === 'content') {
                const contentId = `highlights-content-${index}`;
                // Tab-scope the lookup: highlights-content-N-remove-all ids repeat
                // across panes (N restarts per tab, inactive panes stay in the DOM),
                // so a bare getElementById grabs the FIRST tab's checkbox — wrong
                // essay on a multi-tab restore. Scope to the tab's pane, and use
                // the [id="…"] attribute selector (not `#id`) because querySelector
                // with `#dupId` is unreliable under duplicate ids; the attribute
                // form resolves the per-pane element in both browsers and jsdom.
                const pane = (window.TabStore && scopedTabId)
                    ? window.TabStore.paneForTab(scopedTabId) : null;
                const checkbox = pane
                    ? pane.querySelector(`[id="${contentId}-remove-all"]`)
                    : document.getElementById(`${contentId}-remove-all`);
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
    function setupRemoveAllCheckboxFromAutoSave(checkbox, contentDiv, tabId) {
        if (checkbox.dataset.setupComplete === 'true') return;

        const contentId = checkbox.dataset.contentId || checkbox.id.replace('-remove-all', '');
        // Tab-scoped key via the shared helper. tabId is the restoring tab (passed
        // from reattachHighlightsHandlers); fall back to activeId() inside helper.
        const storageKey = window.removeAllStorageKey
            ? window.removeAllStorageKey(contentId, tabId)
            : `removeAllFromPDF_${contentId}`;
        const savedState = localStorage.getItem(storageKey);

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
            localStorage.setItem(storageKey, checked.toString());
            // (Teacher-note add/subtract is driven by the document-level delegated
            // remove-all listener in display-utils.js.)
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
        // Exposed for tests only (no production caller): lets the regression net
        // drive the legacy-restore highlight reattach directly to pin the
        // per-tab scoping of the remove-all checkbox lookup (the 'content'
        // branch's tab-scope fix). Not part of the public API contract.
        _reattachHighlightsHandlers: reattachHighlightsHandlers,
    };
})();
