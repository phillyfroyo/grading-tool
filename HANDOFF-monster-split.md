# Handoff — auto-save.js monster-file split

_Status as of 2026-06-30, branch `split-monster-files-risky`. This documents what the split did, the resulting architecture, and the open strategy question for the still-coupled clusters (A/C/F). Read alongside `ENGINEERING-NOTES.md` §"REFACTOR PLAN" (the original analysis) and §"Monster-file split — progress + post-split review" (the running log)._

---

## The goal (and what "done" means)

`public/js/grading/auto-save.js` was a 2304-line, single-IIFE monster doing ~8 jobs. The goal is NOT to empty the file and delete it. The goal is to shrink it to its **irreducible cohesive core** — the tightly-coupled save engine + the public API surface — by moving each *separable* concern into its own leaf module.

**End-state model:**
- **auto-save.js = the orchestrator/core.** It keeps the save lifecycle, restore, auth, the `initialize` wiring, the public `window.AutoSaveModule` facade, and thin delegators to each leaf. It stays the file everything loads through. It does NOT become obsolete.
- **Leaf modules** (`auto-save-*.js`) = self-contained concerns, each its own `window.AutoSaveX` global with its own state.

A ~1500-line core that does ONE job (run the save/restore/auth lifecycle) is the target — qualitatively different from a 2300-line file doing eight. "Smaller" is not the metric; "cohesive" is.

---

## What was extracted (the four clean leaves)

Each followed the same playbook: **characterization net (baselined green against current code) → extract → seam test → smoke → commit → push.** Public `AutoSaveModule` members kept on the facade via thin delegators; new module loads BEFORE auto-save.js in index.html.

| Module | Cluster | Lines | Public facade members | Seam(s) |
|--------|---------|-------|----------------------|---------|
| `auto-save-ui.js` (`window.AutoSaveUI`) | E — toasts/banners | 387 | showToast, showClearButton | `resetFullDismissed()` (core-D re-arms the transient full-banner dismiss) |
| `auto-save-grading.js` (`window.AutoSaveGrading`) | G — grading-state + form lock | 157 | markGradingStarted/Finished, isGradingInProgress, setFormLocked | `isGradingInProgress()` getter + `setGradingInProgress()` setter (payload reads, teardown clears) |
| `auto-save-payload.js` (`window.AutoSavePayload`) | B — payload build/de-dup | 297 | _(internal-only)_ | reads gradingInProgress via the Grading getter |
| `auto-save-capacity.js` (`window.AutoSaveCapacity`) | D — capacity/budget | 161 | getCapacityPercent, isPayloadOverBudget | outbound only → AutoSaveUI (banner) + AutoSavePayload (page-load measure) |

**Result:** auto-save.js 2304 → 1562 lines (−32%). Dependency graph is a clean DAG — core → {UI, Grading, Payload, Capacity}; Payload → Grading (getter); Capacity → {UI, Payload}. No module reaches into another's closure; no cycles. Every seam has a guard (`if (window.AutoSaveX)`) and a test.

**Tests:** `tests/frontend/autosave-{ui,grading,payload,capacity}-cluster.test.js` + `reattach-highlights-content-tabscope.test.js`. Suite 12 files / 43 tests green.

**Bonus finds along the way:** deleted dead `countEssayDataGlobals` (B); hardened `setFormLocked` `#gradingForm` → `[id="gradingForm"]` (G); **fixed a real cross-tab restore bug** at auto-save.js:1481 (the post-split dup-id sweep found it — content-branch remove-all lookup grabbed the wrong tab's checkbox on legacy multi-tab restore).

---

## What remains in core — A / C / F (the coupled "save engine")

These were RE-VERIFIED (2026-06-30) to be genuinely coupled, NOT just plan-pessimism (the plan was wrong about B and D being scary — it was right about these):

- **A — Save lifecycle:** `saveImmediately`, `debouncedSave`, `doSave`, `scheduleRetry`, `clearDebounce`
- **C — Restore & reattach (HIGHEST RISK):** `peekSavedSession`, `promptRestoreIfSaved`, `loadAndRestore`, `restoreTabDOM`, `reattachHandlers`, `reattachHighlightsHandlers`, `setupRemoveAllCheckboxFromAutoSave`, `applyScoreOverrides`
- **F — Auth-expiry & stash:** `write/clear/readPendingSaveStash`, `recoverOrphanedStash`, `handleAuthExpired`, `showReauthPrompt`, `attemptReauth`, `flushPendingSave`
- **H — Wiring:** `initialize`

**Why they can't be cheaply extracted — the crux.** They MUTATE shared mutable flags that another cluster's HOT PATH reads (not read-through-a-getter like B/D did):
- `isRestoring` — written by C (restore: 575/724/729), **read by A's `doSave` at 1100** (runs on every debounced edit) + public getter (1544).
- `authExpired` — written by F (905/906/1001/1040), **read by A's `doSave` at 1107**.
- `retryTimer` — spans A (`scheduleRetry`) and F (auth-clear).

To physically separate these you must convert the closure `let`s into a shared object multiple files write (`window.AutoSaveState`). That RELOCATES the coupling into a global rather than removing it — and it's an edit on the exact restore/auth/save code where the recent production bugs lived. Net simplicity gain is questionable; risk is high.

---

## Strategy options for A/C/F (the open question — decide next session)

1. **Leave A/C/F as the cohesive core (status quo).** Accept ~1500 lines as the focused save engine. Lowest risk; arguably correct — these three genuinely belong together. The split is "done" in the sense that matters.
2. **Shared-state layer, in-place first.** Convert `isRestoring`/`authExpired`/`retryTimer` to a `window.AutoSaveState` object IN-PLACE (no file moves), characterization-tested, proving the hot paths survive. THEN A/C/F extractions become mechanical. Multi-session; the risk is front-loaded into one well-tested step.
3. **Extract only the flag-free sub-parts.** Some helpers inside A/C/F don't touch the shared flags (e.g. the stash read/write/clear localStorage helpers in F; `applyScoreOverrides`; pure DOM-reattach helpers in C). These could move to a module without the shared-state risk, shrinking core further while leaving the coupled lifecycle intact. Medium effort, low-ish risk — a likely sweet spot.
4. **Internal cohesion only.** Don't split further; reorganize within auto-save.js (group by cluster, tighten the cluster-map comment). Readability without structural risk.

**Recommendation to revisit:** option 3 (extract flag-free sub-parts, esp. F's stash helpers and C's pure reattach helpers) is probably the best next increment — it continues the win without the shared-state gamble. Option 2 only if there's a strong reason to fully separate A/C/F. Evaluate after this state merges.

---

## Merge readiness

- Branch `split-monster-files-risky` (off `split-monster-files`, off `main`). The whole split stack since main is ~22 commits.
- Post-split review pass: items 2/3/4 (seam audit, facade diff, load-order) CLEAN; item 1 (dup-id sweep) done, 1 bug fixed; item 5 (real-browser edge-case pass) = **the last gate before merge**.
- Suite green (12 files/43 tests); `node --check` clean on all five auto-save files. Multiple smoke tests passed throughout.
- **Before merge to main:** run the full real-browser edge-case pass (multi-tab save/restore, capacity warn/full/dismiss/re-show cycle, form-lock, legacy-restore checkbox scoping, mid-grade refresh). Then this is mergeable.
