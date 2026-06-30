# Design — Unify the single-essay & batch render paths (Family 1 root fix)

_2026-06-30. DESIGN ONLY — no production edits. Output of a two-scout path-mapping
pass (single-essay + batch) plus independent verification of the reachability and
restore facts. Goal: decide whether/how to collapse the duplicated highlights/render
paths so the cross-tab (Family 1) bug class becomes structurally impossible, and to
make the eventual `auto-save.js` split easier. Approve before any build phase._

---

## 1. The core finding (why this matters)

There are **two parallel implementations of the same "graded essay + highlights
dropdown" feature**, differing mostly in id scheme and wiring:

| Concern | Single-essay path | Batch path |
|---|---|---|
| Render | `createSingleEssayHTML` / `SingleResultModule.displayResults` | `displayBatchResults` / `createStudentRowHTML` / `createBatchEssayHTML` |
| Dropdown toggle | `toggleHighlightsSection(contentId)` | `toggleTab('highlights-tab-N', N)` → `loadHighlightsTab(N)` |
| Populate | `populateHighlightsContent` | `loadHighlightsTab` (+ shares `populateHighlightsContent`/`createHighlightsLegendHTML`) |
| Refresh | `refreshHighlightsSection` | `refreshHighlightsTab` |
| Remove-all setup | `setupRemoveAllCheckbox` | `setupRemoveAllCheckboxForTab` |
| Id scheme | `highlights-content` / `highlights-content-N` / `…-inner` | `highlights-tab-N` / `highlights-tab-content-N` |
| Container | `.formatted-essay-content` (no index) | `.formatted-essay-content[data-essay-index="N"]` |

This duplication is the **root of the Family-1 bug class**: every invariant
(tab-scoping, the `.teacher-notes` guard, the remove-all id derivation) has to be
applied in **two** places, and the second one is always the one that ships broken.
Direct evidence from this project: the note-as-highlight bug (two drifted wiring
loops), the remove-all id derivation (copy-pasted 4×), and this session's three
"fixes" that turned out to be on the path users don't hit.

## 2. Reachability — VERIFIED (this is the load-bearing fact)

- **Normal grading = 100% batch path.** `form-handling.js:402-417`: even a 1-essay
  grade is **converted to batch format** (`batchResult`) and rendered via
  `BatchProcessingModule.displayBatchResults`. `GradingDisplayModule.displayResults`
  (single-essay) is an `else if (window.GradingDisplayModule)` **fallback** that only
  fires if `BatchProcessingModule` is absent — i.e. never, in the real app. (Both a
  manual read and the batch scout confirmed this; the single-essay scout misread the
  `else if` as the live path — do not trust that part of its report.)
- **Restore = 100% batch path.** `auto-save.js:494` re-renders via
  `displayBatchResults`. (Note `auto-save.js:587` vs `:601` — restore already has to
  juggle BOTH id schemes, paying the duplication tax even here.)
- **Single-essay path IS live — but ONLY via the "manual-grader" tab, ONE entry.**
  `handleManualGradingSubmission` (form-handling.js:159, bound to the `manualForm`
  submit at :637) → `/api/grade` with `isManualMode:true` →
  `GradingDisplayModule.displayResults(result, gradingData)` (:212), rendering the
  single-essay path into `#results`, unconditionally (no batch fallback). The manual
  grader is its own top-level UI tab (`data-tab="manual-grader"`,
  event-delegation.js:237), a separate sub-app from the multi-tab batch workspace.
- **VERIFIED — there is exactly ONE live manual flow** (recon for open item (a),
  2026-06-30). A SECOND apparent manual flow — `displayManualGradingResults` →
  `#manualResults` (manual-grading.js:10, ui-interactions-main.js:141 wrapper) — is
  **DEAD TEST CODE**: its only callers are `testManualGrading()` (a hardcoded
  `testResult`, manual-grading.js:323) and an `index.html:435` debug block; no real
  button/listener invokes it, and `#manualResults` **does not exist in index.html**
  (it would `return` at the `if(!resultsDiv)` guard). So `manual-grading.js`'s display
  path + `testManualGrading` + the `ui-interactions-main.js` wrapper are deletable dead
  code. The Phase-1 premise ("one live manual entry to reroute") HOLDS.

**Conclusion:** the two render paths are not "two ways to do the same thing in the
same screen" — they map (mostly) onto **two real product modes**: batch grading
(multi-tab workspace) and manual grading (single-essay, its own tab). That reframes
the unification: it is NOT "delete single-essay." It is "make both modes render
through ONE shared component, parameterized by essay identity."

## 3. What's genuinely SHARED vs genuinely DIFFERENT

**Already shared (good — leverage this):**
- `createHighlightsLegendHTML`, `populateHighlightsContent`, `setupTogglePDFListeners`,
  `createHighlightsUISection`, `applyRemoveAllStateToMarks`, `syncAllRemoveAllStateToMarks`,
  `removeAllStorageKey`, `removeAllCheckboxId`, the whole `HighlightingModule`
  (`wireLegacyHighlightSpans` — already unified this session — `editHighlight`,
  `ensureHighlightClickHandlers`). Both paths already call these.
- `createHighlightsUISection(essayIndex)` ALREADY parameterizes the id by index
  (`''` → single, `N` → batch). The single/batch id divergence is largely just
  "index present or not," already expressed in one function.

**Genuinely different:**
- Toggle: `toggleHighlightsSection` (single, self-contained expand/collapse + populate)
  vs `toggleTab` + `loadHighlightsTab` (batch, generic toggle + lazy load with a
  retry-poll for not-yet-rendered essays).
- The batch path has **lazy-load + streaming** machinery (poll for
  `.formatted-essay-content[data-essay-index=N]`, tab-pinning via
  `currentBatchTabId`) the single path has no equivalent for.
- Remove-all setup: `setupRemoveAllCheckbox` (single, document-scoped) vs
  `setupRemoveAllCheckboxForTab` (batch, takes the checkbox+container explicitly).

**Insight:** the divergence is concentrated in **toggle + load**, not in the
content/legend/wiring/remove-all internals (those are already shared or trivially
parameterizable). So unification is smaller than it looks — it's mostly about the
*entry/toggle* layer, not the whole feature.

## 4. Proposed target — "one parameterized highlights component"

Collapse toward the **batch path's structure** (it's the one the live multi-tab app
and restore already use, and it's already tab-scoped), making the single-essay/manual
mode a **degenerate case** (one essay, index `0` or a sentinel) of the same component:

1. **One id scheme.** Standardize on the indexed `highlights-tab-content-N` /
   `highlights-tab-N` family. Manual/single mode uses index `0`. Retire the
   bare `highlights-content` (no-index) scheme. This alone removes the dual-scheme
   juggling in `auto-save.js` restore and `removeAllCheckboxId`.
2. **One toggle.** `toggleTab` is already generic (grade-details AND highlights). Make
   it the single entry; retire `toggleHighlightsSection`. Manual mode calls the same
   `toggleTab`/`loadHighlightsTab`.
3. **One populate/load.** `loadHighlightsTab` already delegates to the shared
   `populateHighlightsContent`/`createHighlightsLegendHTML`. Manual mode reuses it.
4. **One remove-all setup.** Fold `setupRemoveAllCheckbox` into
   `setupRemoveAllCheckboxForTab` (parameterized by checkbox+container+tabId).
5. **One render entry.** Manual grading renders via the batch component for a
   single-element list (exactly what normal single-essay grading ALREADY does at
   form-handling.js:402 — "convert single result to batch format"). The manual tab
   becomes "a batch of one," and `createSingleEssayHTML`/`displayResults`/
   `toggleHighlightsSection`/`refreshHighlightsSection`/`setupRemoveAllCheckbox`
   become **dead code to delete**.

**End state:** one render path, one id scheme, one toggle, one remove-all. Every
Family-1 invariant lives in exactly one place → the bug class is structurally
retired. `auto-save.js` restore simplifies (single scheme) → the later file-split is
cleaner.

## 5. Migration plan (phased, each phase shippable + smoke-testable)

> Principle learned this session: do NOT trust "the test passed" as proof a path is
> exercised — verify reachability and SMOKE-TEST THE BATCH PATH (where users are) at
> each phase. The jsdom net guards structure; the manual smoke catches timing/render.

- **Phase 0 — net + baseline.** Add jsdom tests that pin CURRENT behavior of BOTH
  modes' highlights dropdown (batch via `loadHighlightsTab`; manual via `displayResults`
  → `toggleHighlightsSection`). These are the regression guard for everything below.
  Record a golden-path console baseline.
- **Phase 1 — make manual grading render as a batch-of-one.** Change
  `form-handling.js:212` (manual mode) to route through `displayBatchResults` with the
  single-element wrapper (the normal single path ALREADY does this at :402-414 — copy
  that). Now manual mode uses the batch component. SMOKE: manual-grader tab still grades
  + shows highlights + remove-all + edit. This is the highest-value, lowest-LOC phase —
  it makes the single-essay path unreachable without yet deleting it.
- **Phase 2 — delete the now-dead single-essay path.** Remove
  `createSingleEssayHTML`, `SingleResultModule.displayResults` (single branch),
  `toggleHighlightsSection`, `refreshHighlightsSection`, `setupRemoveAllCheckbox`, the
  bare `highlights-content` id scheme, and their exports. Verify nothing else
  references them (esp. `auto-save.js:601` restore branch — it can drop the
  single-scheme handling). Suite + smoke.
- **Phase 3 — simplify restore.** With one id scheme, collapse `auto-save.js:587/601`
  to a single path. This touches the timing-fragile restore code → jsdom test + a full
  restore smoke (grade → reload → restore → edit → save).
- **Phase 4 (optional, later) — the file split.** With duplication gone, `auto-save.js`
  and `display-utils.js` are smaller and the module boundaries are obvious. Do the
  Cluster-E/UI extraction from the existing refactor plan here.

## 6. Risks & mitigations

- **Restore is the danger zone (Phase 3).** It's the timing-fragile 250/500ms reattach
  code where past bugs lived. Mitigation: do Phase 3 LAST, behind the full net, with a
  mandatory restore smoke test; keep it a separate commit that can be reverted alone.
- **Manual grader has its own quirks** (its own tab, `isManual` flag, possibly
  different feedback fields). Phase 1 must verify the batch component handles the
  manual result shape — may need a small adapter. Mitigation: Phase 1 smoke focuses
  entirely on the manual tab.
- **Hidden consumers of the single-essay ids/functions.** Before Phase 2 delete, grep
  every reference (incl. inline `onclick=` in generated HTML strings and
  `manual-grading.js`/`single-result.js`). Mitigation: a "dead-code proof" grep pass +
  the Phase-0 tests going red if something still calls them.
- **PDF export** reads marks across tabs (`syncAllRemoveAllStateToMarks`). Id-scheme
  change must not break the exporter's selectors. Mitigation: include a PDF-export
  smoke (export with remove-all on) in Phase 2.
- **`createHighlightsUISection('')` no-index branch** is the seam between schemes;
  removing the no-index case is the concrete Phase-2 edit — check all callers.

## 6b. Phase-1 readiness verdict (open-items recon, 2026-06-30)

- **(a) Manual result shape — PREMISE HOLDS, no adapter needed.** Manual mode hits the
  SAME `/api/grade` endpoint as normal single grading (form-handling.js:190 vs :382)
  and gets the SAME grading-result shape; it only stamps client-side flags
  (`isManual`, `studentName`, `originalEssayText`, :206-208). No LIVE render code
  branches on `isManual` (only `:206` SETS it; nothing READS it in the render path).
  Normal single grading ALREADY renders this exact shape through `displayBatchResults`
  (:402-414). So rerouting the manual entry through the batch component is a
  data-shape no-op. **Phase 1 is safe to start.**
- **(b) Dead-code surface — WRINKLE for PHASE 2 (not Phase 1).** Two of the functions
  the design earmarked for deletion have grown SHARED callers, so Phase 2 is not clean
  subtraction:
  - `refreshHighlightsSection('highlights-content')` is invoked by the LIVE eventBus
    listeners (`highlight:updated`/`highlight:removed`, display-utils.js:1406/1425),
    which fire on every highlight edit and loop BOTH id schemes — so it's part of the
    shared edit-refresh path, not purely single-essay.
  - `setupRemoveAllCheckbox` is called from `populateHighlightsContent` (:586), the
    SHARED populate used by both paths.
  - `createSingleEssayHTML` has a fallback twin (`createSingleEssayHTMLFallback`,
    single-result.js:93,710) and a dead reference in `manual-grading.js:64`.
  **Implication:** Phase 2 needs its own untangling pass (separate shared logic from
  single-essay-only logic) BEFORE deleting. This does NOT affect Phase 1 (which
  deletes nothing). Re-scope Phase 2 as "untangle shared-vs-single, then delete the
  single-only remainder," with the eventBus-loop bug (ENGINEERING-NOTES) folded in
  since it lives in the same refresh listeners.

**Bottom line:** Phase 1 is GREEN to start (premise verified, no adapter). Phase 2's
delete is more involved than first drawn — fold the untangling into it. Phase 3
(restore) unchanged. The dead manual-test code (Flow 2, §2) can be deleted opportunistically.

## 7. Recommendation

**Do it, in this order, but treat Phase 1 as a standalone decision point.** Phase 1
(route manual grading through the batch component) is high-value, low-LOC, and
independently shippable — it makes the single path unreachable and proves the batch
component handles the manual case, WITHOUT yet deleting anything. If Phase 1 smoke is
clean, Phases 2–3 (delete + simplify restore) are mostly subtractive and low-risk.
The file split (Phase 4) comes free afterward.

**Open items to confirm before building:** (a) does the batch component fully handle
the manual result shape (Phase 1 adapter?); (b) confirm no external/inline references
to the single-essay functions survive (dead-code grep); (c) agree the manual-grader
UX is allowed to render via the batch component (it already effectively does for
normal single grades).
