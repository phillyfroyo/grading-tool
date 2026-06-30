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
 *   C. Restore & reattach .... loadAndRestore, restoreTabDOM, reattachHandlers,
 *      (DOM rehydrator)        reattachHighlightsHandlers, setupRemoveAllCheckboxFromAutoSave,
 *                              applyScoreOverrides — EXTRACTED to auto-save-restore.js
 *                              (window.AutoSaveRestore). loadAndRestore kept here as a thin
 *                              delegator; peekSavedSession + promptRestoreIfSaved (the
 *                              restore-or-discard modal driver) STAY in core. Shared
 *                              isRestoring flag lives in auto-save-state.js.
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
    // isRestoring is shared cross-file (restore writes it, the save lifecycle
    // reads it) so it lives in window.AutoSaveState, reached via the local
    // isRestoring()/setRestoring() helpers below — NOT a closure `let` here.
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

    // --- Shared cross-cluster state (window.AutoSaveState) ---
    // isRestoring is written by the restore rehydrator (Cluster C, now in
    // auto-save-restore.js) and read by the save lifecycle (doSave) + the public
    // facade. It lives in window.AutoSaveState so both files share one flag.
    // These local accessors keep the core's call sites terse and guard the seam.
    function isRestoring() {
        return !!(window.AutoSaveState && window.AutoSaveState.isRestoring());
    }
    function setRestoring(value) {
        if (window.AutoSaveState) window.AutoSaveState.setRestoring(value);
    }

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

    // --- Cluster C (restore & reattach) — EXTRACTED to auto-save-restore.js ---
    // restoreTabDOM + loadAndRestore (the DOM rehydrator) moved WHOLE to
    // window.AutoSaveRestore. promptRestoreIfSaved (above) stays in core and
    // drives restore via this thin delegator; the public facade re-exports it.
    function loadAndRestore() {
        return window.AutoSaveRestore
            ? window.AutoSaveRestore.loadAndRestore()
            : Promise.resolve(false);
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
        if (isSaving || isRestoring()) {
            console.log(`[AutoSaveDiag] doSave[${source}]: skipped (isSaving=${isSaving}, isRestoring=${isRestoring()})`);
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

    // --- Cluster C (restore & reattach) — EXTRACTED to auto-save-restore.js ---
    // reattachHandlers, reattachHighlightsHandlers, setupRemoveAllCheckboxFromAutoSave,
    // and applyScoreOverrides moved WHOLE to window.AutoSaveRestore (loaded before
    // this file). They were only ever called from within the restore rehydrator
    // (restoreTabDOM/loadAndRestore), which moved with them, so no core delegator
    // is needed here — only loadAndRestore (below) is reached from core.

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
        isRestoring: () => isRestoring(),
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
        // branch's tab-scope fix). Now lives in auto-save-restore.js; this
        // facade entry forwards there so the existing test keeps working.
        // Not part of the public API contract.
        _reattachHighlightsHandlers: function (index, container, type, tabId) {
            return window.AutoSaveRestore
                && window.AutoSaveRestore.reattachHighlightsHandlers(index, container, type, tabId);
        },
    };
})();
