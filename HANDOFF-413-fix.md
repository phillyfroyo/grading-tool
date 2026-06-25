# Handoff — 413 autosave payload fix (branch `fix-413-payload`)

_Last updated: 2026-06-25. Written for the next Claude session so work can resume cleanly._
_(This doc has grown messy across sessions — it is due for a cleanup pass. The newest findings are pinned at the very top; older sections below may overlap or lag.)_

---

## ⭐ CURRENT STATE (2026-06-25) — load test PASSED; branch ready to merge; lots of polish since

### Load test result: the 413 fix works
Ran the exact 30 essays that 413'd a real user (North campus, cristina.martinez), plus 7-8 more, across multiple tabs of ≤10. Every save returned **"Save successful," never a 413.** Payload scaled cleanly:
- 10 essays = 34%, 20 = 57%, 30 = 86%, 33 = 88%, **40 = 110%** (4.17MB, over our 3.8MB ceiling but still under Vercel's real ~4.5MB limit).
- At 110% the over-budget guard correctly flipped `overBudget=true` and blocked further payload-growing edits.
- The efficiency/de-dup work is doing exactly what it was designed for. This is the proof point for the midterms ship.

### Both pre-merge gate items now PASS
1. **Highlights survive a refresh** — verified repeatedly this session (restoring graded sessions is how we found/fixed the dead-controls bug below). Highlights regenerate from marks correctly.
2. **Payload monitoring + never 413** — the load test above. The capacity pill + the new single capacity banner track it live.

So the branch is **functionally ready to merge**. Remaining is the user's own continued heavy-usage monitoring (things can still surface under real load). Merge command is in the gate section below.

### Polish / fixes added AFTER the original 413 work (this session, all committed on the branch)
- **Autosave capacity PILL redesign** — compact pill pinned to the right of the tab bar (a permanent sibling of `.tab-list`, so `renderTabBar()` can't clobber it). System-ui font, tinted color bands, app-standard `.info-icon[data-tooltip]` tooltip with edge-aware positioning. Shows the **true %** including **above 100%** (e.g. "Autosave 110%") with a distinct darker-red `.is-over` band.
- **Capacity BANNER consolidation** — replaced the old stacked per-threshold warning toasts (which left "86%" and "88%" coexisting) with ONE self-updating `#auto-save-capacity` banner: warn at 70%+ (amber, sticky-dismiss for the session), full at 100%+ (red, persists with NO timer, dismissable but re-shows on re-crossing). Removed `CAPACITY_THRESHOLDS`/hysteresis machinery and the old "Autosave capacity: X%" line on the grading-complete banner (the pill covers it).
- **Save banner consolidation** — "Saving…" and "All changes saved" are now ONE in-place banner (`updateSaveStatus`), not two coexisting toasts. Restore shows "Session restored — all prior changes have been saved"; "Grading complete" is suppressed during restore.
- **Dead-controls-after-restore FIX (important correctness fix)** — after a session restore, the category score +/- arrows, the category-note PDF-include toggle, and NEW-highlight creation could go unresponsive (per-element listeners lost on the restore re-render, no delegated fallback). Fixed by giving all three **document-level delegated handlers** (race-immune): `ensureDelegatedArrowStepListener` (single-result.js), delegated toggle in `setupCategoryNoteToggleListeners` (display-utils.js), `ensureDelegatedHighlightMouseup` (text-selection.js). NOTE: this is the class of "intermittent unresponsiveness" the original user reported alongside the 413s — watch for any OTHER control showing the same pattern; the fix template is "delegate it on document."
- **Cleanups** — de-duped `MAX_ESSAYS_PER_TAB` (single source of truth in essay-management.js), fixed stale `max=50` in the new-tab template, de-duped the over-budget highlight guard, removed dead sentinels.

### FINDING 1 — The capacity-% "jitter" on tab switch is NOT a bug (legitimate payload variance)
**Symptom observed:** the autosave % rises/falls as you move between tabs — e.g. 86% with a full 10-essay tab active, drops to 79% when a new EMPTY tab is opened/active, and would climb back if you re-enter a full tab. Looked alarming; it is not.

**Root cause (verified, not assumed):** `buildPayload()` in `public/js/grading/auto-save.js` correctly loops **all** tabs and captures each tab's `renderedHTML` via `gatherTabDOMState` → `TabStore.queryInTab(tabId, …)`, which reads each tab's pane by `data-tab-id` regardless of whether the tab is visible/active (confirmed in `tab-store.js queryInTab`). So **no tab's data is ever dropped** — every graded tab persists in `tabStoreSnapshot.tabs[]`, which is what the modern restore path reads.

The variance comes from the **legacy `sessionData` block** (auto-save.js ~line 1502), which is built ONLY from the **primary tab** (`primaryTabId = batchOriginId || activeId()`):
- `currentBatchData: batchDataForPayload` ← primary (active) tab's full results array (the heavy object)
- `essaySnapshots: primaryDOMState.essaySnapshots` ← primary tab's snapshots

So whichever tab is **active at save time** gets its `currentBatchData` + `essaySnapshots` duplicated into this legacy block. Active full tab → +~270KB → higher %. Active empty tab → block ~empty → ~270KB lower. The duplicate is **already present** in `tabStoreSnapshot.tabs[activeTab]`; the legacy block is a backward-compat copy read ONLY by a pre-Phase-7 rollback restore (the modern path never reads it). Earlier de-dup work already dropped the legacy block's `renderedHTML` (and the highlights HTML) for this same reason; `currentBatchData`+`essaySnapshots` are what still ride along.

**Conclusions:**
- ✅ No data loss, restore is safe, every save succeeded. The % is "honest but jittery" — it reflects real payload size, which legitimately varies with the active tab.
- 🔧 **Latent efficiency opportunity (deferred, not for midterms):** dropping that legacy `sessionData` duplicate would (a) make every save ~270KB lighter = more ceiling headroom, AND (b) kill the jitter at its source. BUT it touches the rollback safety net, so it needs its own branch + testing. Do NOT bundle into cosmetic work.
- The planned **single self-updating capacity banner** (see memory `project_banner_capacity_rework`) makes the pill and banner always agree, which hides the jitter cosmetically — enough for midterms.

### FINDING 2 — `public/js/grading/auto-save.js` is too big; refactor is being PLANNED (not yet executed)
This file (~2200 lines, one IIFE, ~43 functions, lots of shared closure state) does save lifecycle, payload build/de-dup, multi-tab restore, reattach handlers, capacity/budget, toasts/banners, and auth/stash recovery all in one. It's hard to navigate and was the locus of several recent bugs. As of 2026-06-25 a **deep refactor PLAN is being researched** (function clusters, shared-state map, public-API surface, proposed split boundaries, per-step risk + phasing, and a go-now-vs-defer-past-midterms recommendation). **No refactor code yet** — the plan is so the user can make an informed surgical-and-safe-enough-to-do-now decision. Midterms stability comes first; the restore/reattach cluster is the highest-risk region to touch.

---

## TL;DR / where we are

- **Branch `fix-413-payload`** holds a complete fix for the Vercel **4.5MB autosave 413** that was freezing large grading sessions for North campus (Anáhuac) teachers during finals.
- It is **6 commits ahead of `main`, clean fast-forward**, **pushed to origin**, and has a **Vercel preview deploy**.
- It is **NOT merged to prod yet.** The gate before merging is **two preview smoke-tests** the user still needs to run (see "What's left" below).
- Target: ship to prod **before summer-intensive midterms (~7 days out from June 22-23, so roughly June 29 – July 2)**. Plenty of buffer; do not rush a bad prod push.

## The problem (root cause, confirmed with real data)

- Autosave POSTs the **entire session (all tabs) as one JSON body** to `POST /api/grading-session`. Past ~24 essays it exceeds Vercel's ~4.5MB serverless body limit → **413**, retried in a loop, nothing saves, the app effectively **freezes for editing**. The user's North campus teacher (cristina.martinez) hit this with ~30 essays across 2 tabs.
- An earlier gzip fix (already on main) only compressed the **GET (load)** response; the **POST (save)** body was never compressed and large sessions overflowed both directions.
- **Measured on preview:** payload is **~176KB per essay, roughly linear**. Highlights add **<1KB each (negligible)** — base rendered essay HTML is the bulk. So ~24 essays = the practical ceiling regardless of de-duplication. 15 essays measured at **2.64MB**.
- **Key constraint discovered:** highlight edits (add/edit/remove/resize) live **only in the DOM `<mark>` elements**, NOT in structured `inline_issues`. So we **cannot** just drop `renderedHTML` and re-render — that would silently lose manual highlight edits. This is why the "proper" fix (below) is deferred.

## What was built on this branch (the midterms solution)

All client-side; the server round-trips the blob opaquely (no server change needed).

1. **De-dup #1** (`08aeef5`): stopped storing the two regenerable highlight-HTML caches (`highlightsTabHTML`, `highlightsContentHTML`) — they're regenerated on restore from the essay marks via `populateHighlightsContent` (display-utils.js). Removed 2 of 3 full-HTML copies per essay, zero data loss. Also dropped the duplicate highlight HTML from the legacy `sessionData` block (kept `renderedHTML` there for the pre-Phase-7 legacy restore fallback).
2. **413 budget guard** (`08aeef5`): measures serialized payload size each save.
3. **De-dup #2** (`57e338b`): `essaySnapshots` was storing each essay TWICE (by numeric index AND by essayId); restore only reads numeric-index keys, so persist only those. (Turned out small — only ~5% — because renderedHTML dominates.)
4. **Layer 3 hardening** (`ced8f4b`): persistent **capacity chip** in the tab bar ("Autosave X%", green/amber/red), **escalating warning toasts** at 70/85/95% (upward-only, with hysteresis so jitter doesn't spam), **capacity line in the grading-complete banner**, and a **hard block on new highlights at 100%** (ceiling = 3.8MB, under Vercel's 4.5MB).
5. **10-essays-per-tab cap at ADD time** (`7c6155c`): the "Add another essay" button + counter stop at 10, so a teacher can't build an over-limit batch and only discover it at "Grade." Label changed to "(up to 10 essays per tab)". Removed the old disruptive submit-time error modal (replaced with a silent clamp + light toast safety net).
6. **Cap helper note** (`842fee3` then `d8da6c6`): at the cap the button is `disabled` + a small static italic note appears ("10 essays max per tab — open a new tab to grade more."). NOTE: browsers don't show `title` tooltips on disabled buttons — that's why the first tooltip attempt (`842fee3`) looked glitchy; `d8da6c6` replaced it with the static note.

## Merging to prod (the gate — BOTH ITEMS NOW PASS, see CURRENT STATE above)

The pre-merge gate was two preview smoke-tests; both have passed (see CURRENT STATE). Recorded here for reference / re-verification after any further change:

1. **Highlights survive a refresh.** Grade a few essays, add several highlights, let autosave fire (`Save successful` in console), **refresh**, choose **Keep**, reopen highlights → they must all still be there (regenerated from marks). The main correctness risk from the de-dup work. ✅
2. **Payload monitoring + never 413.** Capacity pill shows live %; the single capacity banner warns 70%+ / full 100%+; pushing past the limit never 413s, always `Save successful`. ✅ (Verified by the full load test.)

To ship → **merge `fix-413-payload` → main → push (Vercel auto-deploys prod).** It's a clean fast-forward:
```
git checkout main && git pull --ff-only origin main
git merge --ff-only fix-413-payload && git push origin main
```

## The PROPER fix (next term, separate branch — do NOT rush for midterms)

The real ceiling-raiser: make highlight edits write back to **structured data** (`inline_issues`) so `renderedHTML` becomes a true cache that can be dropped and re-rendered on restore. That cuts the ~176KB/essay base cost dramatically and makes 30+ essays fit. It touches the **highlight engine** (the riskiest code), so it needs proper design + thorough testing on its own branch (`feat/structured-highlights` suggested). Deferred intentionally — the midterms solution (cap + meter + de-dups) makes the failure mode bounded and well-signposted, which is enough for midterms.

## Key files & symbols

- `public/js/grading/auto-save.js` — the big one (~2200 lines; **flagged for a planned refactor, see below**). `buildPayload`, `gatherTabDOMState` (de-dups), `evaluatePayloadBudget` + `getCapacityPercent` + `isPayloadOverBudget` (budget), `updateCapacityChip` (the pill, shows true % incl. >100% via `.is-over`), `updateCapacityBanner` (the single self-updating capacity banner), `updateSaveStatus` (single Saving…/All-saved banner), `showClearButton` (grading-complete / restore banner). Constant: `PAYLOAD_CEILING_BYTES = 3_800_000`. (The old `CAPACITY_THRESHOLDS`/hysteresis are GONE.)
- `public/js/grading/single-result.js` — `ensureDelegatedArrowStepListener` (delegated score +/- arrows), `setupBatchEditableElements`, `handleDelegatedBatchEdit` (delegated score-input fallback — the pattern the dead-controls fix copies).
- `public/js/grading/display-utils.js` — `setupCategoryNoteToggleListeners` (now ONE delegated click handler) + `applyCategoryNoteToggle`.
- `public/js/essay/text-selection.js` — `ensureDelegatedHighlightMouseup` (delegated new-highlight creation); `isHighlightingBlockedByBudget` (shared over-budget guard) used by `applyHighlightToSelection` / `applyBatchHighlightToSelection`.
- `public/js/essay-management.js` — `MAX_ESSAYS_PER_TAB = 10` (single source of truth, exported on `window.EssayManagementModule`), `addAnotherEssay` (clamp), `updateAddEssayControls`, `activeTabEssayRowCount`.
- `public/js/ui/form-handling.js` — submit-time silent clamp safety net; reads `MAX_ESSAYS_PER_TAB` from EssayManagementModule (no longer a duplicated literal).
- `src/controllers/gradingSessionController.js` + `src/services/gradingSessionService.js` — server save/load (opaque blob; no change needed).
- Restore path: `auto-save.js` `restoreTabDOM` re-renders via `displayBatchResults` (calls `/format`); `reattachHandlers` re-wires per-essay handlers; the three controls above are now document-delegated so they survive restore regardless of reattach timing. Legacy highlight-HTML restore blocks are guarded + documented as read-only back-compat.

## Testing approach used

No test suite in repo. Verification = `node --check` on every edited file + manual testing on the running app / Vercel preview (the 413 is a Vercel platform limit that doesn't reproduce locally). The big proof was the user's full load test (the real 30-essay 413 case + more). ENV note: redirect `TMPDIR` to a real-disk dir (e.g. `$PWD/.tmprun`) if any harness hits ENOSPC; clean it up after.

## Working-style reminders (from the user, important)

- Always work on a feature branch, never commit to main/prod directly. Commit only when asked. Per-feature commits preferred.
- This app is **acquisition-critical** (the LMS platform the user uses is evaluating acquiring it; North campus adoption during finals is the proof point). Be **cautious with prod**, verify before concluding, don't over-escalate. The user has repeatedly been right to question assumptions — listen.
- Git commits end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. (The committer identity warning on each commit is harmless — auto-derived local name; user hasn't set git config.)
- `.claude/settings.local.json` shows as modified — leave it out of commits.

## Related future work (noted, not started)

- **Admin dashboard** for usage/errors/cost (see memory `admin_dashboard_idea.md`). Blocked on data gaps: no per-event grading log (sessions are overwritten, so lifetime essay counts aren't recoverable), no campus field on `users`, no token/cost capture. First step is instrumentation, not UI.
- **Legacy `sessionData` duplicate removal** (efficiency) — see Finding 1 above. Dropping the legacy block's `currentBatchData`+`essaySnapshots` would lighten every save by ~270KB AND remove the capacity-% jitter at its source. Touches the pre-Phase-7 rollback safety net, so it needs its own branch + testing. Not for midterms.

---

## 📋 REFACTOR PLAN — `public/js/grading/auto-save.js` (researched 2026-06-25; Phase 1 on-ramp DONE, rest DEFERRED)

Full plan from a deep code analysis, saved so it can be executed post-midterms without re-deriving. **Status:** the safe Phase-1 on-ramp (cluster-map comment + hoisting 3 stray state `let`s) is committed (`5e576ee`). Everything structural below is DEFERRED — do not split files before midterms / before a test harness exists.

### Why it's scary (the crux)
File is ~2218 lines, one IIFE, ~43 functions exposing `window.AutoSaveModule`. Size isn't the obstacle — **shared mutable closure flags are.** A handful of flags cross-link the hardest clusters and are read inside hot paths (`doSave`, `buildPayload`, `loadAndRestore`):
- `isRestoring` (save lifecycle ↔ restore ↔ public getter)
- `authExpired`, `retryTimer` (save lifecycle ↔ auth)
- `gradingInProgress` (grading-state → payload build → public)
- `capacityFullDismissed` (capacity → banner UI)

Splitting these into separate files means converting closure `let`s into a shared `window.AutoSaveState` object — a large, non-mechanical edit on exactly the restore/auth code where the recent bugs lived. With no test suite, that's the wrong risk before a real teacher relies on the save path.

### Function clusters (the cluster map also lives at the top of the file)
- **A. Save lifecycle:** `saveImmediately`, `debouncedSave`, `doSave`, `scheduleRetry`, `clearDebounce`
- **B. Payload build/de-dup:** `buildPayload`, `gatherTabDOMState`, `readEssayData`, `countEssayDataGlobals`, `payloadHasResults`
- **C. Restore & reattach (HIGHEST RISK):** `peekSavedSession`, `promptRestoreIfSaved`, `loadAndRestore`, `restoreTabDOM`, `reattachHandlers`, `reattachHighlightsHandlers`, `setupRemoveAllCheckboxFromAutoSave`, `applyScoreOverrides`
- **D. Capacity/budget:** `evaluatePayloadBudget`, `getCapacityPercent`, `refreshCapacityDisplay`, `updateCapacityChip`, `isPayloadOverBudget`
- **E. Toasts/banners:** `getToastStack`, `showToast`, `showClearButton`, `updateBannerStatus`, `updateSaveStatus`, `updateCapacityBanner`
- **F. Auth-expiry & stash:** `write/clear/readPendingSaveStash`, `recoverOrphanedStash`, `handleAuthExpired`, `showReauthPrompt`, `attemptReauth`, `flushPendingSave`
- **G. Grading-state & lock:** `markGradingStarted/Finished`, `isGradingInProgress`, `setFormLocked`, `clearSavedSession`
- **H. Wiring:** `initialize`

### Public API stability requirement
`window.AutoSaveModule` exposes 15 members; **11 are called externally** and must keep identical signatures+timing after any split: `initialize`, `promptRestoreIfSaved` (index.html); `saveImmediately`, `setFormLocked`, `showClearButton`, `isGradingInProgress`, `markGradingStarted`, `markGradingFinished` (form-handling.js); `saveImmediately` quiet (tab-management.js); `saveImmediately`, `showClearButton`, `isRestoring` (batch-processing.js); `showToast`, `isPayloadOverBudget` (text-selection.js). A split keeps these on `window.AutoSaveModule` via a thin facade. New split files must load at/after auto-save.js's slot in index.html (after all the `window.*Module` deps it calls, before profiles.js).

### Three options (risk spectrum)
1. **In-place reorg (LOW):** one file/IIFE, group functions by cluster + hoist stray state. Zero behavior risk, pure move-diff. **← Phase-1 on-ramp already did the cluster map + hoist; the physical function reorder was intentionally SKIPPED (a 2000-line shuffle is hard to review safely without tests; the cluster map gives ~90% of the navigability benefit at ~1% of the risk).**
2. **Extract Cluster E (UI) to `auto-save-ui.js` (MEDIUM):** ~190 genuinely-independent lines (`getToastStack`…`updateCapacityBanner`). Adds a `window.AutoSaveUI` global + facade re-export of `showToast`/`showClearButton`, and one seam: `capacityFullDismissed` is written by both E (dismiss) and D (`evaluatePayloadBudget`) — resolve with an explicit setter. **First genuinely-structural step; reasonable post-midterms.** (Cluster F/auth is NOT a clean leaf — it shares `authExpired`/`retryTimer` with A — do not extract it.)
3. **Full module split (HIGH):** core + payload + restore + ui + stash with a shared `window.AutoSaveState` object. Converts ~6 closure vars to cross-file mutable state across the riskiest clusters. **Defer until a test harness exists.**

### Phasing (verify each via `node --check` + a golden-path run: grade → reload → restore → edit score → save; diff the `[AutoSave]` console lines against a pre-change baseline)
- **Phase 0:** establish green baseline + record golden-path console lines.
- **Phase 1 (DONE, `5e576ee`):** cluster-map comment + hoist `saveStatusTimer`/`capacityWarnDismissed`/`capacityFullDismissed`. (Physical function reorder skipped — optional later.)
- **Phase 2 (LOW):** delete confirmed-dead code (e.g. verify `countEssayDataGlobals` callers first).
- **Phase 3 (MEDIUM, post-midterms):** extract Cluster E → `auto-save-ui.js`; resolve the `capacityFullDismissed` seam; re-export public UI members on the facade.
- **Phase 4 (MED-HIGH, defer):** extract Cluster B (payload); introduces a `gradingInProgress` seam.
- **Phase 5 (HIGH, NEVER before midterms / never without tests):** Cluster C (restore/reattach) and F (auth). These carry the cross-cluster flags and the timing-fragile 250ms/500ms reattach `setTimeout`s; this is where recent bugs lived. Leave in core.

### Bottom line
Do NOT structurally split before midterms. The Phase-1 on-ramp (committed) buys the readability that prompted this without touching execution. Post-midterms, Phase 3 (extract UI) is the first reasonable structural step; Phases 4–5 should wait for a basic test harness. Lowest-risk next step if momentum is wanted: nothing further is needed pre-midterms — stability first.
