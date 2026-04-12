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

        console.log('[AutoSave] Initialized');
    }

    /**
     * Save immediately (called after grading completes).
     */
    function saveImmediately() {
        clearDebounce();
        hasPendingChanges = true;
        updateBannerStatus('Saving\u2026', 'ok');
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

        // Inject saved rendered HTML (skip /format call)
        if (tabData.renderedHTML) {
            Object.entries(tabData.renderedHTML).forEach(([indexStr, html]) => {
                const idx = parseInt(indexStr, 10);
                const essayDiv = queryInTab(`#batch-essay-${idx}`);
                if (essayDiv && html) {
                    essayDiv.innerHTML = html;
                    reattachHandlers(idx);
                }
            });
        }

        // Inject saved highlights tab HTML
        if (tabData.highlightsTabHTML) {
            Object.entries(tabData.highlightsTabHTML).forEach(([indexStr, html]) => {
                const hlTabDiv = queryInTab(`#highlights-tab-content-${indexStr}`);
                if (hlTabDiv && html) {
                    hlTabDiv.innerHTML = html;
                    hlTabDiv.dataset.loaded = 'true';
                    reattachHighlightsHandlers(parseInt(indexStr, 10), hlTabDiv, 'tab');
                }
            });
        }

        // Inject saved highlights content (grade-details section)
        if (tabData.highlightsContentHTML) {
            Object.entries(tabData.highlightsContentHTML).forEach(([indexStr, html]) => {
                const hlInner = queryInTab(`#highlights-content-${indexStr}-inner`);
                if (hlInner && html) {
                    hlInner.innerHTML = html;
                    hlInner.dataset.populated = 'true';
                    reattachHighlightsHandlers(parseInt(indexStr, 10), hlInner, 'content');
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

        // Apply score overrides
        if (tabData.scoreOverrides) {
            applyScoreOverrides(tabData.scoreOverrides);
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

                        restoreTabDOM(savedTabData, tabId);
                    }
                }

                // 3. Switch to the tab that was active at save time.
                const savedActiveId = tabStoreSnapshot.activeTabId;
                if (savedActiveId && window.TabManagementModule) {
                    window.TabManagementModule.switchTab(savedActiveId);
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

            // Show clear button
            showClearButton();

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

        // Remove any toast or legacy banner
        const toast = document.getElementById('auto-save-toast');
        if (toast) toast.remove();
        const legacyBanner = document.getElementById('auto-save-banner');
        if (legacyBanner) {
            document.body.style.paddingTop = '';
            legacyBanner.remove();
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
    let toastDismissTimer = null;

    function showToast(text, level) {
        // Remove any existing toast
        const existing = document.getElementById('auto-save-toast');
        if (existing) existing.remove();
        if (toastDismissTimer) {
            clearTimeout(toastDismissTimer);
            toastDismissTimer = null;
        }

        const toast = document.createElement('div');
        toast.id = 'auto-save-toast';

        const isWarn = level === 'warn';
        const bg = isWarn ? 'rgba(255,243,205,0.95)' : 'rgba(209,243,209,0.95)';
        const border = isWarn ? 'rgba(200,170,80,0.4)' : 'rgba(100,180,100,0.4)';
        const color = isWarn ? '#856404' : '#2d6a2d';
        const icon = isWarn ? ' ⚠' : ' ✓';

        toast.style.cssText =
            'position:fixed;top:12px;left:12px;z-index:9999;' +
            'padding:10px 18px;border-radius:6px;' +
            'font-family:"Inter","Helvetica Neue",Arial,sans-serif;' +
            'font-size:13px;font-weight:500;letter-spacing:0.01em;' +
            'box-shadow:0 2px 8px rgba(0,0,0,0.12);' +
            'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
            'transition:opacity 0.3s ease;opacity:0;' +
            `background:${bg};border:1px solid ${border};color:${color};`;

        toast.textContent = text + icon;
        document.body.appendChild(toast);

        // Fade in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
        });

        // Auto-dismiss after 5s for success; warnings stay until replaced
        if (!isWarn) {
            toastDismissTimer = setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => {
                    if (toast.parentNode) toast.remove();
                }, 300);
            }, 5000);
        }
    }

    /**
     * Legacy API: showClearButton is called by form-handling.js and
     * batch-processing.js after grading completes. In the old design it
     * created a persistent banner with a Clear button. Now it just shows
     * a brief toast confirming grading is complete.
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

        // Gather essayData entries — prefer the tab's own state
        const essaySnapshots = {};
        if (tabState && tabState.essayData) {
            for (const [idx, ed] of Object.entries(tabState.essayData)) {
                if (ed) essaySnapshots[`essayData_${idx}`] = ed;
            }
        }

        const renderedHTML = {};
        const highlightsTabHTML = {};
        const highlightsContentHTML = {};
        if (!omitHTML) {
            for (let i = 0; i < resultCount; i++) {
                const div = queryInTab(`#batch-essay-${i}`);
                const hasContent = div && div.innerHTML.trim() && div.innerHTML.trim() !== 'Loading formatted result...';
                if (hasContent) {
                    renderedHTML[i] = div.innerHTML;
                }
                const hlTabDiv = queryInTab(`#highlights-tab-content-${i}`);
                if (hlTabDiv && hlTabDiv.dataset.loaded === 'true' && hlTabDiv.innerHTML.trim() && hlTabDiv.innerHTML.trim() !== 'Loading highlights...') {
                    highlightsTabHTML[i] = hlTabDiv.innerHTML;
                }
                const hlContentInner = queryInTab(`#highlights-content-${i}-inner`);
                if (hlContentInner && hlContentInner.dataset.populated === 'true' && hlContentInner.innerHTML.trim()) {
                    highlightsContentHTML[i] = hlContentInner.innerHTML;
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

        return {
            essaySnapshots,
            renderedHTML,
            highlightsTabHTML,
            highlightsContentHTML,
            completedEssays,
            removeAllStates,
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

        // Check if ANY tab has data worth saving
        const allTabs = window.TabStore.all();
        const anyTabHasData = allTabs.some(t =>
            t.currentBatchData || (t.essayData && Object.keys(t.essayData).length > 0)
        );
        if (!anyTabHasData) {
            console.log('[AutoSave] buildPayload: no tab has essay data, skipping');
            return null;
        }

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

        const sessionData = {
            currentBatchData: batchDataForPayload,
            essaySnapshots: primaryDOMState.essaySnapshots,
            renderedHTML: primaryDOMState.renderedHTML,
            highlightsTabHTML: primaryDOMState.highlightsTabHTML,
            highlightsContentHTML: primaryDOMState.highlightsContentHTML,
            scoreOverrides: null, // TODO: per-tab score overrides
            completedEssays: primaryDOMState.completedEssays,
            removeAllStates: primaryDOMState.removeAllStates,
            gradingInProgress,
        };

        // Score overrides from SingleResultModule (currently a singleton,
        // not per-tab — Phase 8 can refactor this if needed)
        if (window.SingleResultModule && window.SingleResultModule.getBatchGradingData) {
            const bgd = window.SingleResultModule.getBatchGradingData();
            if (bgd && Object.keys(bgd).length > 0) {
                sessionData.scoreOverrides = bgd;
            }
        }

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
     * Execute a save if not already saving.
     * @param {string} source - Label identifying the caller (for diagnostics).
     */
    async function doSave(source) {
        source = source || 'unknown';
        if (isSaving || isRestoring) {
            console.log(`[AutoSaveDiag] doSave[${source}]: skipped (isSaving=${isSaving}, isRestoring=${isRestoring})`);
            return;
        }
        const payload = buildPayload();
        if (!payload) {
            console.log(`[AutoSaveDiag] doSave[${source}]: no payload to save`);
            return;
        }

        isSaving = true;
        try {
            console.log(`[AutoSave] Saving session via ${source}…`);
            const resp = await fetch('/api/grading-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                console.warn('[AutoSave] Save failed:', resp.status);
                updateBannerStatus('Changes failed to auto-save, sorry. Do not refresh or close the page.', 'warn');
                scheduleRetry();
            } else {
                console.log('[AutoSave] Save successful');
                lastSuccessfulSaveTime = Date.now();
                hasPendingChanges = false;
                updateBannerStatus('All changes saved', 'ok');
            }
        } catch (err) {
            console.warn('[AutoSave] Save error:', err);
            updateBannerStatus('Changes failed to auto-save, sorry. Do not refresh or close the page.', 'warn');
            scheduleRetry();
        } finally {
            isSaving = false;
        }
    }

    /**
     * Re-attach interactive handlers on a restored essay div.
     */
    function reattachHandlers(index) {
        setTimeout(() => {
            const essayData = readEssayData(index);
            if (!essayData) return;
            const { essay, originalData } = essayData;

            // Strip "already initialized" data attributes from injected HTML.
            // Event listeners don't survive innerHTML injection, but these marker
            // attributes do — causing setup functions to skip re-attaching listeners.
            const essayContainer = window.TabStore
                ? window.TabStore.activeQuery(`#batch-essay-${index}`)
                : document.getElementById(`batch-essay-${index}`);
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
            const essayContentDiv = window.TabStore
                ? window.TabStore.activeQuery(`.formatted-essay-content[data-essay-index="${index}"]`)
                : document.querySelector(`.formatted-essay-content[data-essay-index="${index}"]`);
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

            // Category buttons
            const categoryButtons = document.querySelectorAll(
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

            // Editable score inputs (also calls setupCategoryNoteToggleListeners internally)
            if (
                window.SingleResultModule &&
                window.SingleResultModule.setupBatchEditableElements &&
                essay &&
                originalData
            ) {
                window.SingleResultModule.setupBatchEditableElements(
                    essay.result,
                    originalData,
                    index
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
     */
    function reattachHighlightsHandlers(index, container, type) {
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
                const checkbox = window.TabStore
                    ? window.TabStore.activeQuery(`#highlights-tab-${index}-remove-all`)
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
     */
    function applyScoreOverrides(overrides) {
        if (!overrides) return;

        Object.entries(overrides).forEach(([essayIndex, data]) => {
            if (!data || !data.gradingData || !data.gradingData.scores) return;

            Object.entries(data.gradingData.scores).forEach(([category, scoreData]) => {
                // Find score input for this essay/category
                const container = window.TabStore
                    ? window.TabStore.activeQuery(`#batch-essay-${essayIndex}`)
                    : document.getElementById(`batch-essay-${essayIndex}`);
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
    };
})();
