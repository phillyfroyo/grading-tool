/**
 * auto-save-capacity.js — Cluster D (capacity / budget) extracted from
 * auto-save.js.
 *
 * Owns the payload-size budget: the ceiling constant, the last-measured byte
 * count, and the over-budget edit-block flag. Measures each serialized payload,
 * drives the always-present "Autosave N%" pill, flips the at-ceiling edit block,
 * and feeds the warn/full capacity banner. Exposes window.AutoSaveCapacity.
 *
 * MUST load BEFORE auto-save.js in index.html — the core calls into this.
 *
 * Seams (all OUTBOUND to already-extracted modules; nothing reaches back here):
 *  - window.AutoSaveUI.updateCapacityBanner(pct) + resetFullDismissed() — the
 *    standing capacity banner + its transient-dismiss re-arm.
 *  - window.AutoSavePayload.buildPayload() / payloadHasResults() — used by
 *    refreshCapacityDisplay to measure a restored session on page load.
 * Public members (kept on window.AutoSaveModule via the core's facade):
 * getCapacityPercent, isPayloadOverBudget.
 */
(function () {
    'use strict';

    // Payload-size budget. Highlights add <1KB each (negligible); the base
    // rendered essay HTML is the bulk, so a session of ~24 essays is the
    // practical ceiling. See the Payload reference in ENGINEERING-NOTES.
    const PAYLOAD_CEILING_BYTES = 3_800_000;       // 100% capacity / hard stop (≈3.8MB)
    let payloadOverBudget = false;                 // true once at/over ceiling
    let lastPayloadBytes = 0;                       // diagnostics + pill/banner

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

        // Update the persistent pill every save.
        updateCapacityChip(pct);

        if (bytes >= PAYLOAD_CEILING_BYTES) {
            // At/over the ceiling — block payload-growing edits.
            payloadOverBudget = true;
        } else {
            // Back under the ceiling (e.g. a tab was cleared) — re-enable edits.
            payloadOverBudget = false;
            // We've dropped under 100%, so re-arm the full banner: if capacity
            // climbs back to the ceiling later, the (non-sticky) full banner
            // should show again even if it was dismissed before. The dismissal
            // flag lives in auto-save-ui.js — re-arm via its setter.
            if (window.AutoSaveUI) window.AutoSaveUI.resetFullDismissed();
        }

        // Drive the single self-updating capacity banner. It shows from 70% up,
        // morphs warn→full at 100%, tracks the live %, and honors the dismissal
        // rules (warning sticky for the session; full re-showable). Replaces the
        // old per-threshold stacked toasts.
        if (window.AutoSaveUI) window.AutoSaveUI.updateCapacityBanner(pct);

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
        if (!window.AutoSavePayload) return;
        const payload = window.AutoSavePayload.buildPayload();
        // nothing graded yet — keep the pill hidden
        if (!window.AutoSavePayload.payloadHasResults(payload)) return;
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

            // Show the TRUE percent, including above 100%, so the teacher sees
            // they've gone PAST the ceiling (e.g. "Autosave 110%"), not just "at"
            // it. Only the lower bound is clamped (never negative).
            const shown = Math.max(0, Math.round(pct));

            // Reveal on first real measurement.
            if (chip.hidden) chip.hidden = false;

            // Color band → CSS class. Over 100% gets a distinct darker-red band.
            chip.classList.remove('is-ok', 'is-warn', 'is-full', 'is-over');
            if (shown < 70) chip.classList.add('is-ok');
            else if (shown < 90) chip.classList.add('is-warn');
            else if (shown <= 100) chip.classList.add('is-full');
            else chip.classList.add('is-over');

            const hint = shown >= 90 ? ' — clear a tab' : '';
            textEl.textContent = `Autosave ${shown}%${hint}`;
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

    window.AutoSaveCapacity = {
        getCapacityPercent,
        evaluatePayloadBudget,
        refreshCapacityDisplay,
        updateCapacityChip,
        isPayloadOverBudget,
    };
})();
