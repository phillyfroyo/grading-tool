# Audit checklist — auto-save.js monster-file split + remove-all fix

**Purpose.** This is a list of **falsifiable claims** the refactor makes, for an independent (cold) reviewer to *disprove* — not confirm. Each item states the claim, then *how to attack it* (the concrete thing that, if found, proves the claim false). The reviewer should try to break each one against the code on `main`, not take the author's word.

**Written by the author of the change (in-context) to expose the attack surface; NOT to be verified by the author.** A fresh session or multi-agent review runs it cold.

## Scope & how to diff

- **Baseline (pre-refactor):** commit `d354b76` ("Delete the dead single-essay render path…") — the last commit before the first Cluster-E net.
- **Head:** `main` (currently `5a406b3`).
- **Whole diff:** `git diff d354b76 main -- public/js/grading/ public/index.html`
- **The three merges that compose it:** `19292f8` (E/G/B/D + dead-path cleanup), `47a3d41` (C restore), `5a406b3` (remove-all bleed fix).
- **Files in scope:** `auto-save.js` (−1674 lines), new `auto-save-{ui,grading,payload,capacity,restore,state}.js`, `display-utils.js` (remove-all fix), `index.html` (load order). Plus `tests/frontend/*` nets.

Reviewer mindset: the refactor's core promise is **"a pure move — no behavior changed."** Every claim below is a way that promise could be a lie. Prioritize the ones marked ⚠️ (highest blast radius: restore, the state seam, the bug fix).

---

## A. The "pure move" claim (behavior preservation)

**A1. ⚠️ Every extracted function is byte-identical to its pre-refactor body (only cross-file seam calls changed).**
*Attack:* For each moved function, diff its body baseline-vs-main. Any logic change beyond a seam-call rewrite (`isRestoring` → `AutoSaveState.isRestoring()`, `showClearButton` → `AutoSaveUI.showClearButton`, `readEssayData` → `AutoSavePayload.readEssayData`, etc.) that ISN'T a pure delegation is a violated claim. List of moved fns per module is in `HANDOFF-monster-split.md`.

**A2. No function was silently dropped or duplicated in the move.**
*Attack:* Enumerate every `function NAME` defined at baseline in auto-save.js; confirm each now lives in exactly ONE place (core OR a leaf module), never both, never gone. A function that exists in neither, or in two files, breaks this.

**A3. The DEBOUNCE_MS / PENDING_SAVE_KEY / PAYLOAD_CEILING_BYTES constants kept their exact values after moving.**
*Attack:* grep the constants in their new homes; compare to baseline literals. `DEBOUNCE_MS=2500`, `PAYLOAD_CEILING_BYTES=3_800_000`, `PENDING_SAVE_KEY='gradingTool.pendingSave.v1'`.

## B. Public API surface (the external contract)

**B1. The `window.AutoSaveModule` facade exposes the SAME members as baseline, plus exactly ONE new test-only member (`_reattachHighlightsHandlers`).**
*Attack:* Baseline facade (verified): `initialize, saveImmediately, debouncedSave, loadAndRestore, promptRestoreIfSaved, clearSavedSession, showClearButton, setFormLocked, markGradingStarted, markGradingFinished, isGradingInProgress, isRestoring, isPayloadOverBudget, getCapacityPercent, showToast`. Main should be identical + `_reattachHighlightsHandlers`. Any REMOVED member, or any additional non-test member, breaks the contract. (`git show d354b76:…/auto-save.js` vs `main:…`.)

**B2. Every one of the 11 externally-called facade members still resolves to working code (not a dangling delegator).**
*Attack:* The external callers per HANDOFF/ENGINEERING-NOTES: form-handling.js, tab-management.js, batch-processing.js, text-selection.js, index.html. For each call (e.g. `AutoSaveModule.saveImmediately`, `.isRestoring`, `.showToast`, `.isPayloadOverBudget`), trace the facade delegator → does it reach a real implementation in a loaded module? A delegator forwarding to a `window.AutoSaveX` that ISN'T loaded before auto-save.js (see D) would silently no-op.

**B3. Delegators guard for their target module and don't throw if it's absent.**
*Attack:* Each core delegator should be `window.AutoSaveX && window.AutoSaveX.fn(...)` or `?.`. Find any bare `window.AutoSaveX.fn(...)` that would TypeError if the module failed to load.

## C. The seams (cross-file coupling)

**C1. ⚠️ The dependency graph is a DAG with no cycles; no module reaches into another's closure.**
*Attack:* For each `auto-save-*.js`, list every `window.AutoSaveX` it references. Build the graph. Claimed edges: core→{all}; Payload→Grading; Capacity→{UI,Payload}; Restore→{State,UI,Payload}. A cycle, or a module reading a variable that lives in another file's closure (not via a documented getter/setter), breaks this.

**C2. ⚠️ `isRestoring` has exactly ONE owner (`auto-save-state.js`) and all reads/writes go through its getter/setter.**
*Attack:* grep `isRestoring` across all files. Every write must be `AutoSaveState.setRestoring(...)`; every read `AutoSaveState.isRestoring()` (or the facade getter that calls it). A stray closure `let isRestoring` or a direct assignment anywhere else means the flag is double-owned — the exact bug the seam was meant to prevent.

**C3. ⚠️ The restore→save-lifecycle timing invariant is intact: `doSave` still bails while `isRestoring` is true.**
*Attack:* Confirm `doSave` reads `isRestoring()` and returns early. Then confirm restore still SETS it true for the whole restore and clears it 500ms after (post-reattach). If the set/clear timing shifted, a debounced save could race a half-rebuilt DOM (the failure this guard exists for).

**C4. `clearSavedSession` stayed in core and still clears grading state via the Grading seam.**
*Attack:* It should call `AutoSaveGrading.setGradingInProgress(false)` (not a direct flag write) and remain the teardown orchestrator. Verify it wasn't accidentally moved into a leaf.

## D. Load order (index.html)

**D1. ⚠️ Every `auto-save-*.js` dependency loads BEFORE the file that calls into it.**
*Attack:* Read the `<script>` order in index.html. Required: `auto-save-state.js` before restore+core; `auto-save-ui.js`, `auto-save-payload.js` before their consumers (capacity, restore, core); `auto-save-restore.js` before core. Any module loaded AFTER a caller that touches it at load time (not just inside a function body) is a live bug. (Function-body references are forgiving; top-level ones are not.)

**D2. Cache-busting versions were bumped where content changed.**
*Attack:* auto-save.js should be `?v=44` (was 43). New files present with a version param. A stale `?v=` on a changed file = teachers get old code.

## E. Cluster-specific behavior (the extracted logic)

**E1. Restore swap-guard: id-mapped saves pair HTML by `data-essay-id`; legacy partial saves refuse index injection.**
*Attack:* In `auto-save-restore.js` restoreTabDOM, confirm the `renderedHTMLEssayIds` branch matches by id and the legacy-no-idMap branch skips injection when `anyFailed || renderedCount < successCount`. Weakening either reintroduces cross-student essay swaps. (Pinned by `autosave-restore-cluster.test.js`.)

**E2. Capacity math + bands unchanged: 100% = PAYLOAD_CEILING_BYTES, over-budget flips at/over ceiling, pill bands at 70/90/100.**
*Attack:* Compare `auto-save-capacity.js` thresholds to baseline. (Pinned by `autosave-capacity-cluster.test.js`.)

**E3. Payload de-dup: essaySnapshots keep the numeric-only key filter; dual sessionData+tabStoreSnapshot contract preserved.**
*Attack:* `auto-save-payload.js` buildPayload/gatherTabDOMState vs baseline. (Pinned by `autosave-payload-cluster.test.js`.)

**E4. Dead code deletions were actually dead.**
*Attack:* The refactor deleted `countEssayDataGlobals` (claimed 0 callers) and earlier a whole single-essay/manual render path. grep the codebase for any remaining reference to the deleted symbols. A live caller = a real breakage hidden by "it's dead."

## F. The remove-all bleed fix (display-utils.js, commit ed212fa)

**F1. ⚠️ `setupRemoveAllCheckbox` scopes ALL its index-based lookups to the checkbox's own pane.**
*Attack:* Confirm the checkbox-find uses `activeQuery([id="…-remove-all"])` (or a passed `checkboxEl`), and the `${contentId}-inner` container + mark lookups use the `queryInPane` helper (from `checkbox.closest('.tab-pane')`). Any remaining bare `document.getElementById(`${contentId}-inner`)` in this function reintroduces the bleed.

**F2. ⚠️ The multi-tab-restore interaction is safe: setup does NOT re-resolve the checkbox via activeQuery when restore passes one.**
*Attack:* `auto-save-restore.js` must call `setupRemoveAllCheckbox(contentId, checkbox)` with the `paneForTab(restoringTab)`-resolved checkbox. If it calls the 1-arg form, setup re-resolves via activeQuery — and because the active tab flips behind the 250ms reattach timeout, it would scope to the WRONG tab. (Pinned by the restore-race test in `remove-all-live-toggle-crosstab.test.js`.)

**F3. The fix did NOT touch the separate batch family (`setupRemoveAllCheckboxForTab`) or the already-scoped student-details/mark lookups.**
*Attack:* Confirm the diff is confined to `setupRemoveAllCheckbox`. The mark lookups by `elementId` (globally-unique `highlight-<i>-<ts>-<rand>`) and the `: document.getElementById(...)` fallback branches were intentionally left; verify none were the actual leak. If a sibling still bleeds, the fix is incomplete.

**F4. `queryInPane`'s document fallback (when `ownPane` is null) doesn't reintroduce the bleed in a real path.**
*Attack:* Confirm the remove-all UI always renders inside a `.tab-pane` in the live app (so `ownPane` is never null in practice). If there's a real render path where the checkbox is NOT inside a `.tab-pane`, the fallback goes document-wide again.

## G. Tests (are the nets real, or do they pass vacuously?)

**G1. Each characterization net drives the REAL artifact (eval-into-jsdom), not a stub.**
*Attack:* Confirm the nets `loadModules(... real files ...)` and call `window.AutoSaveX.fn` — not a hand-rolled reimplementation. A net that tests a mock proves nothing about the move.

**G2. ⚠️ The nets actually FAIL when the behavior they pin is broken.**
*Attack:* For a high-value net (restore swap-guard; remove-all bleed), mutate the production code to reintroduce the bug and confirm the test goes red. A net that stays green under a broken implementation is a false safety signal. (The remove-all + restore-cluster nets were authored this way — verify the claim.)

**G3. The suite count is honest: 14 files / 51 tests, all green on main, no `.skip`/`.only`.**
*Attack:* Run `npx vitest run`; grep the test files for `.skip(` / `.only(` / `it.todo`. A skipped test inflates the count without coverage.

## H. Things explicitly NOT done (confirm they weren't half-done)

**H1. Cluster A (save lifecycle) and F (auth/stash) were intentionally left in core.**
*Attack:* Confirm `doSave/saveImmediately/debouncedSave/scheduleRetry/clearDebounce` (A) and the auth/stash fns (F) still live in auto-save.js — not partially moved. A half-extracted cluster (some fns moved, seams dangling) would be worse than not touching it.

**H2. `authExpired` / `retryTimer` are still core closure state (NOT prematurely moved to AutoSaveState).**
*Attack:* grep confirms they're `let` in auto-save.js, not in auto-save-state.js. The seam deliberately owns ONLY `isRestoring`; if F's flags leaked into the state module without F's extraction, that's an inconsistent half-step.

---

## How to run the audit

Recommended: a multi-agent review — one cold reader per section (A–H), each reading the real files on `main` and trying to DISPROVE its claims, reporting only violations found (with file:line + the failing scenario). Synthesize into a single findings list ranked by severity. The ⚠️ items are where a real regression would hide; weight coverage there.

Do NOT have the review "confirm the refactor is good." Have it try to break each claim. Silence on a claim = "attacked, could not disprove," not "looks fine."
