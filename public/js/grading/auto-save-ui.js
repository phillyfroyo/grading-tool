/**
 * auto-save-ui.js — Cluster E (toasts / banners UI) extracted from auto-save.js.
 *
 * This is the presentation layer of the autosave system: the top-left toast
 * stack, the save-lifecycle banner, and the single self-updating capacity
 * banner. It owns its own UI state (dismiss timers + capacity-dismissal flags)
 * and exposes a small API on window.AutoSaveUI. auto-save.js (the core save
 * lifecycle) delegates to it through thin local wrappers and re-exports the two
 * public members (showToast / showClearButton) on window.AutoSaveModule.
 *
 * MUST load BEFORE auto-save.js in index.html — auto-save.js calls into this.
 *
 * Seam with the core (Cluster D, capacity): the capacity banner's "full" (≥100%)
 * dismissal is transient — when the payload drops back under 100% the core
 * re-arms it by calling AutoSaveUI.resetFullDismissed(). That's the one piece of
 * state the core touches; everything else here is private to this module.
 */
(function () {
    'use strict';

    // --- Banner/toast UI state ---
    let saveStatusTimer = null;                    // dismiss timer for the save-status banner
    // Capacity-banner dismissals. The warning (70–99%) is dismissable AND sticky:
    // once the teacher dismisses it, it stays gone for the rest of the session
    // (they rely on the omnipresent pill). The full banner (≥100%) is dismissable
    // but NOT sticky — it re-shows whenever capacity is at/over the ceiling.
    let capacityWarnDismissed = false; // sticky: warning dismissed for the session
    let capacityFullDismissed = false; // transient: cleared whenever we drop <100%

    // Toasts live in a fixed top-left stack (newest on top); each self-dismisses
    // on its own timer, and when one is removed the others slide up to fill the
    // gap (the flex column reflows automatically).

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

    /**
     * Insert a TRANSIENT banner (a save/restore/grading toast or the save-status
     * banner) at the top of the stack — but BELOW the standing capacity banner
     * if one is showing. The capacity banner (amber/red) has no auto-dismiss, so
     * keeping it pinned at the very top stops it from bouncing down and back up
     * every time a short-lived toast appears above it on each edit/autosave.
     */
    function insertTransient(stack, el) {
        const capacity = document.getElementById('auto-save-capacity');
        if (capacity && capacity.parentNode === stack) {
            // Place directly after the capacity banner.
            stack.insertBefore(el, capacity.nextSibling);
        } else {
            stack.insertBefore(el, stack.firstChild);
        }
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

        // Width: keep the uniform fixed 420px only for warnings (yellow) and
        // errors (red) — the payload-capacity warnings. Every other (green)
        // success toast shrinks to fit its text. Because the stack is a flex
        // column with default align-items:stretch, a plain max-width still
        // stretches to stack width — align-self:flex-start + width:fit-content
        // is what actually shrinks it (same pattern as the save-status banner).
        const fixedWidth = isWarn || isError;
        const widthCss = fixedWidth
            ? 'width:420px;box-sizing:border-box;'
            : 'max-width:420px;width:fit-content;align-self:flex-start;';

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
            'white-space:pre-line;' + widthCss +
            `background:${bg};border:1px solid ${border};color:${color};`;
        toast.textContent = fullText;

        // Newest on top — but below a standing capacity banner if present.
        insertTransient(stack, toast);

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

    /**
     * Single, reusable banner for the SAVE lifecycle (Saving… → All changes
     * saved → or Couldn't save…). Unlike showToast (which stacks a new toast per
     * call), this updates ONE persistent element in place, so "Saving…" and
     * "All changes saved" never coexist as two contradictory banners — the same
     * banner just changes text and color.
     *
     * It lives at the top of the same top-left stack as the other toasts.
     * 'pending' (Saving…) has no auto-dismiss — it stays until the outcome
     * replaces it. 'ok'/'warn' auto-dismiss after a short read.
     *
     * @param {string} text
     * @param {'pending'|'ok'|'warn'} state
     */
    function updateSaveStatus(text, state) {
        const stack = getToastStack();

        let banner = document.getElementById('auto-save-status');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'auto-save-status';
            banner.className = 'auto-save-toast'; // share dismissal/query class
            banner.style.cssText =
                'pointer-events:auto;padding:10px 18px;border-radius:6px;' +
                'font-family:"Inter","Helvetica Neue",Arial,sans-serif;' +
                'font-size:13px;font-weight:500;letter-spacing:0.01em;' +
                'box-shadow:0 2px 8px rgba(0,0,0,0.12);' +
                'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
                'transition:opacity 0.3s ease,background-color 0.25s ease,' +
                'border-color 0.25s ease,color 0.25s ease;opacity:0;' +
                // Fit-to-text (not a fixed width): the save-lifecycle banner
                // (Saving… / All changes saved) fires constantly during editing,
                // so a full-width box every few seconds was overwhelming. The
                // standing capacity banner keeps its fixed width.
                // NOTE: the toast stack is a flex column (align-items:stretch),
                // so a plain max-width still stretches to the stack's width —
                // align-self:flex-start + width:fit-content is what shrinks it
                // to the text.
                'white-space:pre-line;max-width:420px;width:fit-content;align-self:flex-start;';
        }
        // Keep it at the top — but below a standing capacity banner if present.
        insertTransient(stack, banner);

        const isWarn = state === 'warn';
        const suffix = state === 'pending' ? '' : isWarn ? ' ⚠' : ' ✓';
        let bg, border, color;
        if (isWarn) {
            bg = 'rgba(255,243,205,0.95)'; border = 'rgba(200,170,80,0.4)'; color = '#856404';
        } else {
            bg = 'rgba(209,243,209,0.95)'; border = 'rgba(100,180,100,0.4)'; color = '#2d6a2d';
        }
        banner.style.background = bg;
        banner.style.borderTop = banner.style.borderRight = banner.style.borderBottom =
            banner.style.borderLeft = '1px solid ' + border;
        banner.style.color = color;
        banner.textContent = text + suffix;
        requestAnimationFrame(() => { banner.style.opacity = '1'; });

        // Manage auto-dismiss. Resolved states ('ok'/'warn') fade after a short
        // read. 'pending' (Saving…) normally stays until the outcome replaces
        // it, but gets a long SAFETY fade so it can't get stuck on screen if a
        // doSave path returns early without reporting an outcome (auth expired,
        // no payload, save already in flight).
        if (saveStatusTimer) { clearTimeout(saveStatusTimer); saveStatusTimer = null; }
        const fadeMs = state === 'pending' ? 15000 : 5000;
        saveStatusTimer = setTimeout(() => {
            banner.style.opacity = '0';
            setTimeout(() => { if (banner.parentNode) banner.remove(); }, 300);
        }, fadeMs);
    }

    /**
     * Single, reusable CAPACITY banner — sibling concept to updateSaveStatus.
     * One element (#auto-save-capacity) that updates its % in place rather than
     * stacking a new toast per threshold (the old showToast approach left "86%"
     * and "88%" banners coexisting). Lives in the same top-left stack.
     *
     * Two states, by capacity:
     *  - 'warn' (70–99%): amber, live %, dismissable + STICKY (capacityWarnDismissed).
     *  - 'full' (≥100%):  red, live %, persists (no timer), dismissable but NOT
     *                     sticky — re-shows whenever ≥100%.
     * Below 70% (state null) the banner is removed.
     *
     * @param {number} pct - true capacity percent (may exceed 100)
     */
    function updateCapacityBanner(pct) {
        const stack = getToastStack();
        const existing = document.getElementById('auto-save-capacity');

        const state = pct >= 100 ? 'full' : pct >= 70 ? 'warn' : null;

        // Below the warning floor → nothing to show; clear any existing banner.
        if (!state) {
            if (existing) existing.remove();
            return;
        }

        // Respect dismissals. Warning dismissal is sticky for the session; the
        // full banner ignores the warning dismissal (it's too important) but
        // honors its own transient dismissal until we drop back under 100%.
        if (state === 'warn' && capacityWarnDismissed) {
            if (existing) existing.remove();
            return;
        }
        if (state === 'full' && capacityFullDismissed) {
            if (existing) existing.remove();
            return;
        }

        const isFull = state === 'full';
        const shown = Math.round(pct);
        const text = isFull
            ? `Autosave is full (${shown}%). New highlights can’t be saved. ` +
              `Download completed essays (PDF) and clear a finished tab — or start ` +
              `a fresh session — to keep working.`
            : `Autosave is at ${shown}% capacity. Before reaching 100%, download ` +
              `completed essays and clear a finished tab to keep the app working reliably.`;

        let banner = existing;
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'auto-save-capacity';
            banner.className = 'auto-save-toast';
            banner.style.cssText =
                'pointer-events:auto;position:relative;padding:10px 34px 10px 18px;' +
                'border-radius:6px;font-family:"Inter","Helvetica Neue",Arial,sans-serif;' +
                'font-size:13px;font-weight:500;letter-spacing:0.01em;' +
                'box-shadow:0 2px 8px rgba(0,0,0,0.12);' +
                'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
                'transition:opacity 0.3s ease,background-color 0.25s ease,' +
                'border-color 0.25s ease,color 0.25s ease;opacity:0;' +
                'white-space:pre-line;width:420px;box-sizing:border-box;';

            const msg = document.createElement('span');
            msg.className = 'capacity-banner-msg';
            // The text lives in a child <span>, so the global `p, li, span {
            // font-size: 18px }` rule in main.css overrides the banner div's
            // inline 13px and renders this banner LARGER than the green save/
            // restore toasts (whose text is set directly on the div). Re-declare
            // the toast typography ON the span so it matches the others exactly.
            msg.style.cssText =
                'font-family:"Inter","Helvetica Neue",Arial,sans-serif;' +
                'font-size:13px;font-weight:500;letter-spacing:0.01em;';
            banner.appendChild(msg);

            const dismiss = document.createElement('button');
            dismiss.type = 'button';
            dismiss.className = 'capacity-banner-dismiss';
            dismiss.setAttribute('aria-label', 'Dismiss');
            dismiss.textContent = '×';
            dismiss.style.cssText =
                'position:absolute;top:4px;right:6px;border:none;background:transparent;' +
                'font-size:18px;line-height:1;cursor:pointer;color:inherit;opacity:0.55;' +
                'padding:2px 4px;';
            dismiss.addEventListener('mouseenter', () => { dismiss.style.opacity = '0.9'; });
            dismiss.addEventListener('mouseleave', () => { dismiss.style.opacity = '0.55'; });
            dismiss.addEventListener('click', function () {
                // Record the dismissal per current state, then remove.
                if (banner.dataset.state === 'full') capacityFullDismissed = true;
                else capacityWarnDismissed = true;
                banner.style.opacity = '0';
                setTimeout(() => { if (banner.parentNode) banner.remove(); }, 300);
            });
            banner.appendChild(dismiss);
        }
        banner.dataset.state = state;

        // Color band.
        let bg, border, color;
        if (isFull) {
            bg = 'rgba(248,215,218,0.97)'; border = 'rgba(180,80,80,0.5)'; color = '#721c24';
        } else {
            bg = 'rgba(255,243,205,0.95)'; border = 'rgba(200,170,80,0.4)'; color = '#856404';
        }
        banner.style.background = bg;
        banner.style.border = '1px solid ' + border;
        banner.style.color = color;
        banner.querySelector('.capacity-banner-msg').textContent =
            text + (isFull ? ' ⚠' : ' ⚠');

        // Keep the capacity banner pinned at the very top of the stack — but
        // only move it if it isn't already there, so re-running this on every
        // save (capacity is recomputed each save) doesn't churn the DOM or
        // flicker. Transient toasts insert BELOW it (see insertTransient).
        if (stack.firstChild !== banner) {
            stack.insertBefore(banner, stack.firstChild);
        }
        requestAnimationFrame(() => { banner.style.opacity = '1'; });
        // No auto-dismiss timer for either state — capacity is a standing
        // condition; it goes away only on explicit dismiss or dropping <70%.
    }

    /**
     * Re-arm the (non-sticky) full banner. Called by the core (Cluster D) when
     * the payload drops back under 100%, so that if capacity later climbs to the
     * ceiling again the full banner shows even if it was dismissed before. This
     * is the one bit of UI state the core touches — see the seam note up top.
     */
    function resetFullDismissed() {
        capacityFullDismissed = false;
    }

    window.AutoSaveUI = {
        getToastStack,
        insertTransient,
        showToast,
        showClearButton,
        updateBannerStatus,
        updateSaveStatus,
        updateCapacityBanner,
        resetFullDismissed,
    };
})();
