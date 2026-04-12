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
     * Lock or unlock the grading form. When locked:
     *   - Essay entry headers (name/nickname inputs) and text areas are hidden.
     *   - Grade, Add Another Essay, and essay counter controls are disabled.
     *   - An inline message appears next to the grade button pointing users
     *     at the "Clear & Start Fresh" banner button.
     *
     * @param {boolean} locked
     */
    function setFormLocked(locked) {
        formLocked = locked;
        const formIds = ['gradingForm'];
        const inlineMessageText =
            "You have saved graded essays below. Click 'Clear & Start Fresh' at the top to grade more essays.";

        formIds.forEach(formId => {
            const form = document.getElementById(formId);
            if (!form) return;

            // Hide or show essay-header rows (name/nickname) and textareas.
            // We toggle the entire .essay-entry so the collapse is clean and
            // there are no orphan name fields floating without content below.
            form.querySelectorAll('.essay-entry').forEach(entry => {
                entry.style.display = locked ? 'none' : '';
            });

            // Disable or enable submit + add-another + remove buttons.
            const gradeBtn = form.querySelector('button[type="submit"]');
            if (gradeBtn) {
                gradeBtn.disabled = locked;
                gradeBtn.style.opacity = locked ? '0.5' : '';
                gradeBtn.style.cursor = locked ? 'not-allowed' : '';
            }

            const addBtn = form.querySelector('#addEssayBtn, [id$="EssayBtn"]');
            if (addBtn) {
                addBtn.disabled = locked;
                addBtn.style.opacity = locked ? '0.5' : '';
                addBtn.style.cursor = locked ? 'not-allowed' : '';
            }

            // Essay count input and its arrow overlays
            const countInput = form.querySelector('#essayCountInput, [id$="EssayCountInput"]');
            if (countInput) {
                countInput.disabled = locked;
                countInput.style.opacity = locked ? '0.5' : '';
            }
            form.querySelectorAll('.essay-counter-arrow').forEach(arrow => {
                arrow.style.pointerEvents = locked ? 'none' : '';
                arrow.style.opacity = locked ? '0.5' : '';
            });

            // Remove-essay buttons inside each entry (covered by entry hide,
            // but belt-and-suspenders in case an entry is ever shown again).
            form.querySelectorAll('.remove-essay-btn').forEach(btn => {
                btn.disabled = locked;
            });

            // Insert or remove the inline message next to the grade button.
            const existingMsg = form.querySelector('.auto-save-lock-message');
            if (locked) {
                if (!existingMsg) {
                    const msg = document.createElement('div');
                    msg.className = 'auto-save-lock-message';
                    msg.textContent = inlineMessageText;
                    msg.style.cssText =
                        'display: inline-block; margin-left: 12px; padding: 6px 10px;' +
                        'color: #666; font-size: 13px; font-style: italic;' +
                        'max-width: 360px; vertical-align: middle; line-height: 1.4;';
                    // Place it inside .essay-controls next to the buttons
                    const controls = form.querySelector('.essay-controls') || gradeBtn?.parentElement;
                    if (controls) {
                        controls.appendChild(msg);
                    }
                }
            } else {
                if (existingMsg) existingMsg.remove();
            }
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
            const results = sessionData.currentBatchData?.batchResult?.results;
            const essayCount = Array.isArray(results) ? results.length : 0;
            return {
                exists: true,
                essayCount,
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
        if (peek.gradingInProgress) {
            titleEl.textContent = 'Your last grading session was interrupted';
            messageEl.textContent =
                `${peek.essayCount} ${essayWord} ${peek.essayCount === 1 ? 'was' : 'were'} saved before the interruption. ` +
                `Would you like to keep them or start fresh?`;
        } else {
            titleEl.textContent = 'You have graded essays from your last session';
            messageEl.textContent =
                `${peek.essayCount} ${essayWord} from your previous session ${peek.essayCount === 1 ? 'was' : 'were'} auto-saved. ` +
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
    async function loadAndRestore() {
        try {
            const resp = await fetch('/api/grading-session');
            if (!resp.ok) return false;
            const data = await resp.json();
            if (!data.exists) return false;

            const { activeTab, sessionData } = data;
            console.log('[AutoSave] Restoring saved session…');
            isRestoring = true;

            // 1. Switch to saved tab
            if (activeTab && window.TabManagementModule) {
                window.TabManagementModule.switchTab(activeTab);
            }

            // 2. Render student list skeleton via displayBatchResults
            //    (this overwrites essayData_* globals with originals, so we re-restore after)
            if (sessionData.currentBatchData && window.BatchProcessingModule) {
                const restoreTabState = window.TabStore && window.TabStore.active();
                if (restoreTabState) {
                    restoreTabState.currentBatchData = sessionData.currentBatchData;
                } else {
                    window.currentBatchData = sessionData.currentBatchData;
                }
                const { batchResult, originalData } = sessionData.currentBatchData;
                const bData = originalData || sessionData.currentBatchData.batchData;
                if (batchResult && bData) {
                    window.BatchProcessingModule.displayBatchResults(batchResult, bData);
                }
            }

            // 3. Re-restore tab state (displayBatchResults overwrites essayData with originals)
            const postDisplayTabState = window.TabStore && window.TabStore.active();
            if (sessionData.currentBatchData) {
                if (postDisplayTabState) {
                    postDisplayTabState.currentBatchData = sessionData.currentBatchData;
                } else {
                    window.currentBatchData = sessionData.currentBatchData;
                }
            }
            if (sessionData.essaySnapshots) {
                Object.entries(sessionData.essaySnapshots).forEach(([key, val]) => {
                    // Snapshot keys are in the legacy "essayData_N" format.
                    // Parse out the index and store on the active tab's essayData map.
                    const match = key.match(/^essayData_(\d+)$/);
                    if (match && postDisplayTabState) {
                        postDisplayTabState.essayData[parseInt(match[1], 10)] = val;
                    } else {
                        // Fallback: restore as legacy window global
                        window[key] = val;
                    }
                });
            }

            // 4. Inject saved rendered HTML (skip /format call)
            const htmlKeys = sessionData.renderedHTML ? Object.keys(sessionData.renderedHTML) : [];
            console.log('[AutoSave] renderedHTML keys:', htmlKeys, 'lengths:', htmlKeys.map(k => (sessionData.renderedHTML[k] || '').length));
            if (sessionData.renderedHTML) {
                Object.entries(sessionData.renderedHTML).forEach(([indexStr, html]) => {
                    const idx = parseInt(indexStr, 10);
                    const essayDiv = window.TabStore
                        ? window.TabStore.activeQuery(`#batch-essay-${idx}`)
                        : document.getElementById(`batch-essay-${idx}`);
                    if (essayDiv && html) {
                        essayDiv.innerHTML = html;
                        // Re-attach interactive handlers for this essay
                        reattachHandlers(idx);
                    }
                });
            }

            // 4b. Inject saved highlights tab HTML
            if (sessionData.highlightsTabHTML) {
                Object.entries(sessionData.highlightsTabHTML).forEach(([indexStr, html]) => {
                    const hlTabDiv = window.TabStore
                        ? window.TabStore.activeQuery(`#highlights-tab-content-${indexStr}`)
                        : document.getElementById(`highlights-tab-content-${indexStr}`);
                    if (hlTabDiv && html) {
                        hlTabDiv.innerHTML = html;
                        hlTabDiv.dataset.loaded = 'true';
                        reattachHighlightsHandlers(parseInt(indexStr, 10), hlTabDiv, 'tab');
                    }
                });
            }

            // 4c. Inject saved highlights content (grade-details section)
            if (sessionData.highlightsContentHTML) {
                Object.entries(sessionData.highlightsContentHTML).forEach(([indexStr, html]) => {
                    const hlInner = window.TabStore
                        ? window.TabStore.activeQuery(`#highlights-content-${indexStr}-inner`)
                        : document.getElementById(`highlights-content-${indexStr}-inner`);
                    if (hlInner && html) {
                        hlInner.innerHTML = html;
                        hlInner.dataset.populated = 'true';
                        reattachHighlightsHandlers(parseInt(indexStr, 10), hlInner, 'content');
                    }
                });
            }

            // 4d. Restore remove-all checkbox states
            if (sessionData.removeAllStates) {
                Object.entries(sessionData.removeAllStates).forEach(([contentId, checked]) => {
                    if (!checked) return;
                    // For highlights-tab: checkbox id is "highlights-tab-${i}-remove-all"
                    // For highlights-content: checkbox id is "highlights-content-${i}-remove-all"
                    const cbId = contentId + '-remove-all';
                    // Also check the alternate format from the tab
                    const tabMatch = contentId.match(/^highlights-tab-content-(\d+)$/);
                    const actualCbId = tabMatch ? `highlights-tab-${tabMatch[1]}-remove-all` : cbId;
                    const cb = document.getElementById(actualCbId);
                    if (cb) {
                        cb.checked = true;
                    }
                });
            }

            // 5. Apply score overrides
            if (sessionData.scoreOverrides) {
                applyScoreOverrides(sessionData.scoreOverrides);
            }

            // 6. Restore mark-complete checkbox states
            if (sessionData.completedEssays) {
                Object.entries(sessionData.completedEssays).forEach(([indexStr, checked]) => {
                    if (checked && window.BatchProcessingModule) {
                        window.BatchProcessingModule.markStudentComplete(parseInt(indexStr, 10), true);
                    }
                });
            }

            // 7. Auto-resize feedback textareas that have long content
            setTimeout(() => {
                document.querySelectorAll('.editable-feedback').forEach(textarea => {
                    textarea.style.height = 'auto';
                    textarea.style.height = Math.max(34, textarea.scrollHeight) + 'px';
                });
            }, 400);

            // 8. Show clear button
            showClearButton();

            // Delay clearing isRestoring until after reattachHandlers timeouts (250ms)
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

        // Unlock form and clear the grading-in-progress flag so the next
        // save doesn't re-persist a stale interrupted state.
        gradingInProgress = false;
        setFormLocked(false);

        try {
            await fetch('/api/grading-session', { method: 'DELETE' });
        } catch (e) {
            console.warn('[AutoSave] Delete request failed:', e);
        }

        // Clear tab state and legacy globals
        const clearTabState = window.TabStore && window.TabStore.active();
        const activeBatchData = (clearTabState && clearTabState.currentBatchData) || window.currentBatchData;
        if (activeBatchData) {
            const count = activeBatchData.batchResult?.results?.length || 0;
            for (let i = 0; i < count; i++) {
                if (clearTabState) delete clearTabState.essayData[i];
                delete window[`essayData_${i}`];
            }
        }
        // Clear any remaining essayData entries (up to a reasonable max)
        for (let i = 0; i < 50; i++) {
            if (clearTabState) delete clearTabState.essayData[i];
            if (window[`essayData_${i}`]) delete window[`essayData_${i}`];
        }
        if (clearTabState) {
            clearTabState.currentBatchData = null;
            clearTabState.originalBatchDataForRetry = null;
        }
        window.currentBatchData = null;
        window.originalBatchDataForRetry = null;

        // Clear results div in active tab
        document.querySelectorAll('#results').forEach(div => {
            div.innerHTML = '';
            div.style.display = 'none';
        });

        // Clear batch progress area
        document.querySelectorAll('.batch-progress-container').forEach(el => el.remove());

        // Reset forms
        const forms = ['gradingForm'];
        forms.forEach(id => {
            const f = document.getElementById(id);
            if (f) f.reset();
        });

        // Remove banner and reset body padding
        const banner = document.getElementById('auto-save-banner');
        if (banner) {
            document.body.style.paddingTop = '';
            banner.remove();
        }

        // Clear SingleResultModule batch data
        if (window.SingleResultModule && window.SingleResultModule.clearGradingState) {
            window.SingleResultModule.clearGradingState();
        }

        console.log('[AutoSave] Session cleared');
    }

    /**
     * Show the fixed auto-save banner at the top of the viewport.
     * Left side: status text. Right side: "Clear & Start Fresh" button.
     */
    function showClearButton(statusText) {
        if (document.getElementById('auto-save-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'auto-save-banner';
        banner.style.cssText =
            'position:fixed;top:0;left:0;right:0;z-index:9999;' +
            'display:flex;align-items:center;justify-content:space-between;' +
            'padding:4px 20px;' +
            'background:rgba(209,243,209,0.92);' +
            'border-bottom:1px solid rgba(100,180,100,0.4);' +
            'box-shadow:0 1px 3px rgba(0,0,0,0.06);' +
            'font-family:"Inter","Helvetica Neue",Arial,sans-serif;' +
            'font-size:12px;color:#2d6a2d;letter-spacing:0.01em;' +
            'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';

        // Status text (left)
        const status = document.createElement('span');
        status.id = 'auto-save-status';
        status.style.cssText = 'font-weight:500;';
        setStatusContent(status, statusText || 'Session restored', 'ok');

        // Clear button (right)
        const btn = document.createElement('button');
        btn.textContent = 'Clear & Start Fresh';
        btn.style.cssText =
            'padding:4px 14px;' +
            'background:#e8e8e8;color:#444;' +
            'border:1px solid #ccc;border-radius:4px;' +
            'font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;' +
            'transition:background 0.15s;white-space:nowrap;';
        btn.addEventListener('mouseover', () => {
            btn.style.background = '#dcdcdc';
        });
        btn.addEventListener('mouseout', () => {
            btn.style.background = '#e8e8e8';
        });
        btn.addEventListener('click', function () {
            if (confirm('This will clear all graded essays. Are you sure?')) {
                clearSavedSession();
            }
        });

        banner.appendChild(status);
        banner.appendChild(btn);
        document.body.appendChild(banner);

        // Push page content down so banner doesn't overlap it
        document.body.style.paddingTop = banner.offsetHeight + 'px';
    }

    /**
     * Set status span content with optional trailing icon.
     */
    function setStatusContent(statusEl, text, level) {
        statusEl.innerHTML = '';
        statusEl.appendChild(document.createTextNode(text));
        if (level === 'ok') {
            const icon = document.createElement('span');
            icon.textContent = ' \u2713';
            icon.style.cssText = 'font-weight:400;margin-left:4px;';
            statusEl.appendChild(icon);
        }
    }

    /**
     * Update the banner status text and appearance.
     * @param {string} text - Status message
     * @param {'ok'|'warn'} level - Visual style
     */
    function updateBannerStatus(text, level) {
        const banner = document.getElementById('auto-save-banner');
        const status = document.getElementById('auto-save-status');
        if (!banner || !status) return;

        setStatusContent(status, text, level);

        if (level === 'warn') {
            banner.style.background = 'rgba(255,243,205,0.95)';
            banner.style.borderBottomColor = 'rgba(200,170,80,0.4)';
            banner.style.color = '#856404';
            status.style.color = '#856404';
        } else {
            banner.style.background = 'rgba(209,243,209,0.92)';
            banner.style.borderBottomColor = 'rgba(100,180,100,0.4)';
            banner.style.color = '#2d6a2d';
            status.style.color = '#2d6a2d';
        }
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
     * Look up essay data by index. Prefers the active tab's essayData map,
     * falls back to the legacy window global.
     */
    function readEssayData(index) {
        const tab = window.TabStore && window.TabStore.active();
        if (tab && tab.essayData && tab.essayData[index]) return tab.essayData[index];
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
     * Build the POST body for /api/grading-session.
     * @param {boolean} omitHTML - If true, skip rendered HTML to keep payload small.
     */
    function buildPayload(omitHTML) {
        // Read active tab's batch data, falling back to legacy window global
        const activeTabState = window.TabStore && window.TabStore.active();
        const activeBatchData = (activeTabState && activeTabState.currentBatchData) || window.currentBatchData;

        // Diagnostic: snapshot the state that buildPayload sees on entry
        const dbgCBDCount = activeBatchData?.batchResult?.results?.length;
        const dbgTabGlobalsCount = activeTabState
            ? Object.keys(activeTabState.essayData || {}).length
            : 0;
        const dbgWinGlobalsCount = Object.keys(window).filter(k => /^essayData_\d+$/.test(k)).length;
        console.log(
            `[AutoSaveDiag] buildPayload entry: ` +
            `currentBatchData.results=${dbgCBDCount ?? 'null'}, ` +
            `tab essayData entries=${dbgTabGlobalsCount}, ` +
            `window essayData_* globals=${dbgWinGlobalsCount}`
        );

        // Determine essay count from currentBatchData OR by scanning essayData entries
        const resultCount = activeBatchData?.batchResult?.results?.length
            || countEssayDataGlobals();

        if (resultCount === 0) {
            console.log('[AutoSave] buildPayload: no essay data found, skipping');
            return null;
        }

        // If currentBatchData is missing, reconstruct a local copy from
        // essayData entries for THIS save only. Do NOT write it back to
        // the live state — doing so used to corrupt the global during
        // in-progress streaming, freezing it at a partial count and skipping
        // the authoritative post-stream assignment in handleGradingFormSubmission.
        let batchDataForPayload = activeBatchData;
        if (!batchDataForPayload) {
            console.log('[AutoSave] buildPayload: reconstructing local batchData from essayData entries (not persisting)');
            const results = [];
            const essays = [];
            for (let i = 0; i < resultCount; i++) {
                const ed = readEssayData(i);
                if (ed) {
                    results.push(ed.essay);
                    essays.push(ed.originalData);
                }
            }
            batchDataForPayload = {
                batchResult: { results, totalEssays: results.length },
                originalData: { essays }
            };
        }

        const activeTab = document.querySelector('.tab-button.active');
        const activeTabName = activeTab ? activeTab.getAttribute('data-tab') : 'gpt-grader';

        // Gather essayData entries into the snapshots map for persistence.
        // Key format stays as "essayData_N" for backward compatibility with
        // the existing save format; Phase 7 will restructure persistence.
        const essaySnapshots = {};
        for (let i = 0; i < resultCount; i++) {
            const ed = readEssayData(i);
            if (ed) {
                essaySnapshots[`essayData_${i}`] = ed;
            }
        }

        // Gather rendered HTML from DOM (for instant restore)
        const renderedHTML = {};
        const highlightsTabHTML = {};
        const highlightsContentHTML = {};
        if (!omitHTML) {
            for (let i = 0; i < resultCount; i++) {
                const div = window.TabStore
                    ? window.TabStore.activeQuery(`#batch-essay-${i}`)
                    : document.getElementById(`batch-essay-${i}`);
                const hasContent = div && div.innerHTML.trim() && div.innerHTML.trim() !== 'Loading formatted result...';
                if (hasContent) {
                    renderedHTML[i] = div.innerHTML;
                }

                // Save highlights tab content ("Manage Highlights" standalone tab)
                const hlTabDiv = window.TabStore
                    ? window.TabStore.activeQuery(`#highlights-tab-content-${i}`)
                    : document.getElementById(`highlights-tab-content-${i}`);
                if (hlTabDiv && hlTabDiv.dataset.loaded === 'true' && hlTabDiv.innerHTML.trim() && hlTabDiv.innerHTML.trim() !== 'Loading highlights...') {
                    highlightsTabHTML[i] = hlTabDiv.innerHTML;
                }

                // Save highlights content within grade-details section
                const hlContentInner = window.TabStore
                    ? window.TabStore.activeQuery(`#highlights-content-${i}-inner`)
                    : document.getElementById(`highlights-content-${i}-inner`);
                if (hlContentInner && hlContentInner.dataset.populated === 'true' && hlContentInner.innerHTML.trim()) {
                    highlightsContentHTML[i] = hlContentInner.innerHTML;
                }
            }
        }

        // Gather score overrides from SingleResultModule
        let scoreOverrides = null;
        if (window.SingleResultModule && window.SingleResultModule.getBatchGradingData) {
            const bgd = window.SingleResultModule.getBatchGradingData();
            if (bgd && Object.keys(bgd).length > 0) {
                scoreOverrides = bgd;
            }
        }

        // Gather mark-complete checkbox states
        const completedEssays = {};
        for (let i = 0; i < resultCount; i++) {
            const cb = window.TabStore
                ? window.TabStore.activeQuery(`.mark-complete-checkbox[data-student-index="${i}"]`)
                : document.querySelector(`.mark-complete-checkbox[data-student-index="${i}"]`);
            if (cb && cb.checked) {
                completedEssays[i] = true;
            }
        }

        // Gather remove-all checkbox states (checked property doesn't survive innerHTML)
        const removeAllStates = {};
        for (let i = 0; i < resultCount; i++) {
            // Highlights tab remove-all checkbox
            const hlTabCb = window.TabStore
                ? window.TabStore.activeQuery(`#highlights-tab-${i}-remove-all`)
                : document.getElementById(`highlights-tab-${i}-remove-all`);
            if (hlTabCb && hlTabCb.checked) {
                removeAllStates[`highlights-tab-content-${i}`] = true;
            }
            // Grade-details highlights remove-all checkbox
            const hlContentCb = window.TabStore
                ? window.TabStore.activeQuery(`#highlights-content-${i}-remove-all`)
                : document.getElementById(`highlights-content-${i}-remove-all`);
            if (hlContentCb && hlContentCb.checked) {
                removeAllStates[`highlights-content-${i}`] = true;
            }
        }

        const sessionData = {
            currentBatchData: batchDataForPayload,
            essaySnapshots,
            renderedHTML,
            highlightsTabHTML,
            highlightsContentHTML,
            scoreOverrides,
            completedEssays,
            removeAllStates,
            gradingInProgress,
        };

        // Sanity check: essaySnapshots is the source of truth for restore.
        // renderedHTML is a display cache (only populated for expanded essays)
        // and is expected to be smaller. Warn loudly if snapshots diverges from
        // resultCount, which would indicate real data loss before persistence.
        const snapshotCount = Object.keys(essaySnapshots).length;
        const renderedCount = Object.keys(renderedHTML).length;
        if (snapshotCount < resultCount) {
            console.warn(
                `[AutoSave] buildPayload: snapshot/result MISMATCH — ` +
                `resultCount=${resultCount}, essaySnapshots=${snapshotCount}, ` +
                `renderedHTML=${renderedCount}. ` +
                `Some essay data is missing from window.essayData_* globals and will not persist.`
            );
        } else {
            console.log(
                `[AutoSave] buildPayload: resultCount=${resultCount}, ` +
                `essaySnapshots=${snapshotCount}, renderedHTML=${renderedCount} ` +
                `(rendered cache is expected to be ≤ snapshots; collapsed essays lazy-load on expand)`
            );
        }

        return {
            activeTab: activeTabName,
            sessionData,
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
