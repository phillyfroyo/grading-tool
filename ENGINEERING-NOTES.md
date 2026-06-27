# Engineering Notes

_Living doc: known issues, future work, the auto-save.js refactor plan, and a payload reference. Originated as the `fix-413-payload` branch handoff; the 413 work shipped to `main` on 2026-06-27 (merged via `pdf-export`), so the build narrative was trimmed to a reference and the still-relevant parts kept._

---

## Known issues (open, deferred)

- **`updateRemoveAllCheckboxState` doesn't auto-tick the master "Remove all" checkbox in BATCH view** (`public/js/grading/display-utils.js`, ~line 1176). It resolves the checkbox as `` `${contentId}-remove-all` ``, which is correct for the single-essay family (`highlights-content-N` → `highlights-content-N-remove-all`) but WRONG for the batch family: `contentId` there is `highlights-tab-content-N`, while the actual checkbox id is `highlights-tab-N-remove-all` (the `-content` is dropped). So `getElementById` returns null and the function silently `return`s for batch.
  - **Symptom:** in batch view, if a teacher manually clicks individual − buttons until *every* highlight is excluded, the master "Remove all" checkbox doesn't auto-check. That's the only effect — marks still exclude correctly, the PDF exports correctly, and clicking the master checkbox directly still works. Cosmetic auto-sync only, rare flow.
  - **Pre-existing:** confirmed identical before the 2026-06-27 UI session (the id mismatch predates the "move remove-all into the dropdown" work; not introduced or worsened by it).
  - **Why not a drive-by fix:** the 3-line `tabMatch` id-mapping (same pattern used ~4× elsewhere in this file) makes it *find* the checkbox, but the function sets `checkbox.checked` WITHOUT writing localStorage or dispatching a change event (deliberate, see the inline comment). Turning it on for batch widens the exposure of visual-vs-persisted drift (master ticks visually but `removeAllFromPDF_*` localStorage stays false → can reset on re-render/restore). A proper fix decides whether this reverse-sync should persist + flow through the delegated change path, which is its own small test matrix — treat as a "remove-all consistency" ticket, not a one-liner.

- **A teacher-notes span can get "branded" as a highlight (rare, intermittent; NOT reproduced on demand).** Observed 2026-06-27 on exactly one essay (essay 1 of tab 3) in a 33-essay session, IDENTICALLY across local, preview, AND prod. The teacher note rendered with a blue box and, when clicked, opened the **Edit Highlight** modal as if the note were a graded error.
  - **Captured evidence** — the corrupted element (from browser inspect):
    ```html
    <span class="teacher-notes-content"
          style="font-size: 14px; border: 2px solid rgb(0, 123, 255); background-color: rgb(255, 255, 255); cursor: pointer;"
          contenteditable="true"
          id="highlight-1782590721524-6pxfbskrn">Let's work on grammar, as this needs the most attention.</span>
    ```
    Two states are fused onto this ONE span: (1) a **highlight id** in the exact format `applyHighlight` stamps on new highlights (`highlight-${Date.now()}-${random}` — the single-essay path, `public/js/essay/highlighting.js:177`; note no essay-index prefix), and (2) a **frozen inline-edit state** (`contenteditable="true"` + the blue `#007bff` border + `cursor:pointer`) left over from `makeElementEditable` in `public/js/ui/editing-functions.js` — the cleanup that clears contenteditable on blur/save never ran.
  - **Why it is data/runtime state, not a code regression:** code would affect all 33 essays identically; only one is affected. The same bad span shows in every environment because all three RESTORE THE SAME server-side autosaved session. Crucially, the owner reports this essay was graded days ago and looked NORMAL through dozens of refreshes/restores/commits — so the corruption is NOT baked-in-from-grading replaying; it is transient runtime state that got applied during a session and then captured by an autosave.
  - **Leading hypothesis (mechanism):** the teacher note was inline-edited (→ `contenteditable` + blue border) and, mid-edit, a text selection inside the note fired highlight creation, which stamped a `highlight-` id and short-circuited the edit-cleanup (so contenteditable stayed `true`). Autosave then persisted the span mid-corruption. The intersection "editing a note WHILE a highlight mouseup fires" is exactly the kind of rare race that can hide for days.
  - **Latent gap that most likely enables it:** the document-level delegated highlight-mouseup (`public/js/essay/text-selection.js:309`, `ensureDelegatedHighlightMouseup`) creates a highlight for any non-collapsed selection inside `.formatted-essay-content` and has **no exclusion for the `.teacher-notes` region**. If the note block sits within / adjacent to the highlightable content, selecting its text can trigger highlight creation over it.
  - **Status: classified as a rare intermittent bug; NOT fixed reactively.** Don't blind-fix the selection handler on this acquisition-critical path without a reproduction — the risk of perturbing highlighting outweighs this rare cosmetic-to-annoying issue (the note TEXT is intact; only its element identity is wrong). When addressed: (a) exclude `.teacher-notes`/`.teacher-notes-content` from `ensureDelegatedHighlightMouseup`'s target test, (b) ensure `makeElementEditable` always clears `contenteditable` even if an interaction interrupts blur/save, and (c) optionally a one-time sanitizer that strips a `highlight-*` id / stuck contenteditable from any `.teacher-notes-content` on render. To clean a single existing bad span (optional), a console one-liner on that essay can remove the `id`, `contenteditable`, and inline `border`/`cursor`, then let autosave persist the corrected note.

---

## Future work (noted, not started)

- **The PROPER payload fix (the real ceiling-raiser).** Make highlight edits write back to **structured data** (`inline_issues`) so `renderedHTML` becomes a true cache that can be dropped and re-rendered on restore. That cuts the ~176KB/essay base cost dramatically and makes 30+ essays fit comfortably. It touches the **highlight engine** (the riskiest code), so it needs proper design + thorough testing on its own branch (`feat/structured-highlights` suggested). The shipped solution (cap + meter + de-dups, see Payload reference) makes the failure mode bounded and well-signposted, which was enough for midterms — this is the next-term raise-the-ceiling project.
- **Legacy `sessionData` duplicate removal** (efficiency) — see the Payload reference. Dropping the legacy block's `currentBatchData`+`essaySnapshots` would lighten every save by ~270KB AND remove the capacity-% jitter at its source. Touches the pre-Phase-7 rollback safety net, so it needs its own branch + testing.
- **Admin dashboard** for usage/errors/cost (see memory `admin_dashboard_idea.md`). Blocked on data gaps: no per-event grading log (sessions are overwritten, so lifetime essay counts aren't recoverable), no campus field on `users`, no token/cost capture. First step is instrumentation, not UI.

---

## Payload reference (the 413 fix — for if payload trouble resurfaces at prod)

The Vercel **4.5MB serverless body limit** was 413'ing large autosaves (autosave POSTs the **entire session — all tabs — as one JSON body** to `POST /api/grading-session`). North campus (Anáhuac) teacher cristina.martinez hit it with ~30 essays across 2 tabs during finals: every save 413'd, retried in a loop, nothing saved, the app froze for editing. Shipped to `main` 2026-06-27.

**Root-cause facts (measured on preview):**
- Payload is **~176KB per essay, roughly linear**. Highlights add **<1KB each (negligible)** — the base rendered essay HTML is the bulk. So ~24 essays is the practical ceiling regardless of de-dup. 15 essays ≈ 2.64MB; load test hit 40 essays = 4.17MB (110% of our ceiling).
- **Key constraint:** highlight edits (add/edit/remove/resize) live **only in the DOM `<mark>` elements**, NOT in structured `inline_issues`. So you **cannot** just drop `renderedHTML` and re-render — that silently loses manual highlight edits. (This is exactly what the "proper fix" in Future Work changes.)

**What shipped (all client-side; server round-trips the blob opaquely):**
- **De-dup #1** (`08aeef5`): stopped storing the two regenerable highlight-HTML caches (`highlightsTabHTML`, `highlightsContentHTML`) — regenerated on restore from marks via `populateHighlightsContent`. Also dropped the duplicate highlight HTML from the legacy `sessionData` block.
- **413 budget guard** (`08aeef5`): measures serialized payload size each save. Constant **`PAYLOAD_CEILING_BYTES = 3_800_000`** (3.8MB, under Vercel's ~4.5MB). At 100% a **hard block on new highlights** kicks in.
- **De-dup #2** (`57e338b`): `essaySnapshots` was stored twice (numeric index AND essayId); restore reads only numeric-index keys, so only those persist.
- **Capacity meter + cap**: the autosave **% pill** in the tab bar (true %, incl. >100%), one self-updating capacity **banner** (warn 70%+ / full 100%+), and a **10-essays-per-tab cap at add time** so a teacher can't build an over-limit batch.
- An earlier gzip fix (already on main before this) compressed only the GET (load) response; the POST (save) body was the overflow.

**The capacity-% "jitter" on tab switch is NOT a bug.** `buildPayload()` correctly loops ALL tabs (via `gatherTabDOMState` → `TabStore.queryInTab`, which reads each pane by `data-tab-id` regardless of visibility), so no tab's data is ever dropped. The variance comes from the **legacy `sessionData` block** (auto-save.js ~line 1502), built ONLY from the active/primary tab — so the active tab's `currentBatchData`+`essaySnapshots` (~270KB) gets duplicated into a backward-compat block read only by a pre-Phase-7 rollback restore (the modern path never reads it). Active full tab → +270KB → higher %; active empty tab → lower. Honest-but-jittery; removing the duplicate (see Future Work) would kill it at the source.

**Key symbols:** `auto-save.js` — `buildPayload`, `gatherTabDOMState`, `evaluatePayloadBudget`/`getCapacityPercent`/`isPayloadOverBudget`, `updateCapacityChip` (pill), `updateCapacityBanner`, `updateSaveStatus`. `essay-management.js` — `MAX_ESSAYS_PER_TAB = 10` (single source of truth). Server save/load is `src/controllers/gradingSessionController.js` (+ service) — opaque blob, no change needed.

**Testing note:** no test suite in repo. Verification = `node --check` on edited files + manual testing on the running app / Vercel preview (the 413 is a Vercel platform limit that doesn't reproduce locally). If a harness hits ENOSPC, redirect `TMPDIR` to a real-disk dir (e.g. `$PWD/.tmprun`) and clean up after.

---

## 📋 REFACTOR PLAN — `public/js/grading/auto-save.js` (researched 2026-06-25; Phase 1 on-ramp DONE, rest DEFERRED)

Full plan from a deep code analysis, saved so it can be executed post-midterms without re-deriving. **Status:** the safe Phase-1 on-ramp (cluster-map comment + hoisting 3 stray state `let`s) is committed (`5e576ee`). Everything structural below is DEFERRED — do not split files before a test harness exists.

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
- **Phase 5 (HIGH, NEVER without tests):** Cluster C (restore/reattach) and F (auth). These carry the cross-cluster flags and the timing-fragile 250ms/500ms reattach `setTimeout`s; this is where recent bugs lived. Leave in core.

### Bottom line
Do NOT structurally split before a test harness exists. The Phase-1 on-ramp (committed) buys the readability that prompted this without touching execution. Post-midterms, Phase 3 (extract UI) is the first reasonable structural step; Phases 4–5 should wait for a basic test harness.
