# Handoff — auto-save.js monster-file split

_Status as of 2026-06-30, branch `split-monster-acf` (commit `b9147b9`, pushed). E/G/B/D are merged to main; **C (restore) is now also extracted** (this branch). This documents what the split did, the resulting architecture, and the concrete plan for the last coupled cluster, **F (auth/stash)** — see "Cluster F — extraction plan" below. A stays as the cohesive core save engine. Read alongside `ENGINEERING-NOTES.md` §"REFACTOR PLAN" (the original analysis) and §"Monster-file split — progress + post-split review" (the running log)._

---

## The goal (and what "done" means)

`public/js/grading/auto-save.js` was a 2304-line, single-IIFE monster doing ~8 jobs. The goal is NOT to empty the file and delete it. The goal is to shrink it to its **irreducible cohesive core** — the tightly-coupled save engine + the public API surface — by moving each *separable* concern into its own leaf module.

**End-state model:**
- **auto-save.js = the orchestrator/core.** It keeps the save lifecycle, restore, auth, the `initialize` wiring, the public `window.AutoSaveModule` facade, and thin delegators to each leaf. It stays the file everything loads through. It does NOT become obsolete.
- **Leaf modules** (`auto-save-*.js`) = self-contained concerns, each its own `window.AutoSaveX` global with its own state.

A ~1500-line core that does ONE job (run the save/restore/auth lifecycle) is the target — qualitatively different from a 2300-line file doing eight. "Smaller" is not the metric; "cohesive" is.

---

## What was extracted (five modules + the state seam)

Each followed the same playbook: **characterization net (baselined green against current code) → extract → seam test → smoke → commit → push.** Public `AutoSaveModule` members kept on the facade via thin delegators; new module loads BEFORE auto-save.js in index.html.

| Module | Cluster | Lines | Public facade members | Seam(s) |
|--------|---------|-------|----------------------|---------|
| `auto-save-ui.js` (`window.AutoSaveUI`) | E — toasts/banners | 387 | showToast, showClearButton | `resetFullDismissed()` (core-D re-arms the transient full-banner dismiss) |
| `auto-save-grading.js` (`window.AutoSaveGrading`) | G — grading-state + form lock | 157 | markGradingStarted/Finished, isGradingInProgress, setFormLocked | `isGradingInProgress()` getter + `setGradingInProgress()` setter (payload reads, teardown clears) |
| `auto-save-payload.js` (`window.AutoSavePayload`) | B — payload build/de-dup | 297 | _(internal-only)_ | reads gradingInProgress via the Grading getter |
| `auto-save-capacity.js` (`window.AutoSaveCapacity`) | D — capacity/budget | 161 | getCapacityPercent, isPayloadOverBudget | outbound only → AutoSaveUI (banner) + AutoSavePayload (page-load measure) |
| `auto-save-restore.js` (`window.AutoSaveRestore`) | C — restore/reattach | 782 | loadAndRestore (delegator) + `_reattachHighlightsHandlers` (test hook) | `setRestoring()` via AutoSaveState; showClearButton via UI; readEssayData via Payload |
| `auto-save-state.js` (`window.AutoSaveState`) | — (shared flag) | 35 | isRestoring (public getter reads it) | getter/setter for `isRestoring`, shared by restore (writes) + core `doSave` (reads) |

**Result:** auto-save.js 2304 → **868 lines** (−62%). Dependency graph is a clean DAG — core → {UI, Grading, Payload, Capacity, Restore, State}; Payload → Grading (getter); Capacity → {UI, Payload}; Restore → {State, UI, Payload}. No module reaches into another's closure; no cycles. Every seam has a guard (`if (window.AutoSaveX)`) and a test.

**Tests:** `tests/frontend/autosave-{ui,grading,payload,capacity,restore}-cluster.test.js` + `reattach-highlights-content-tabscope.test.js`. Suite 13 files / 48 tests green.

**Bonus finds along the way:** deleted dead `countEssayDataGlobals` (B); hardened `setFormLocked` `#gradingForm` → `[id="gradingForm"]` (G); **fixed a real cross-tab restore bug** at auto-save.js:1481 (the post-split dup-id sweep found it — content-branch remove-all lookup grabbed the wrong tab's checkbox on legacy multi-tab restore).

---

## ✅ C DONE (2026-06-30) — the pattern F should copy

Cluster **C (restore/reattach)** was extracted on branch **`split-monster-acf`** (off `origin/main`), commit **`b9147b9`**, pushed. NOT a rewrite — a disciplined MOVE, bodies byte-identical, only the cross-file seam calls delegated out. This proved the approach F should follow.

- New **`auto-save-state.js` (`window.AutoSaveState`)** — the ONE genuinely cross-file flag (`isRestoring`) as a getter/setter-owned value (`isRestoring()` / `setRestoring()`). Deliberately minimal — NOT a junk drawer for every flag. This is the SCOPED version of old "option 2": move only the flag that actually crosses a file boundary, when its cluster moves.
- New **`auto-save-restore.js` (`window.AutoSaveRestore`)** — `loadAndRestore`, `restoreTabDOM`, `reattachHandlers`, `reattachHighlightsHandlers`, `setupRemoveAllCheckboxFromAutoSave`, `applyScoreOverrides`. Seams forward to `AutoSaveState` / `AutoSaveUI` / `AutoSavePayload`.
- **Stayed in core:** `peekSavedSession` + `promptRestoreIfSaved` (the restore-or-discard modal driver) + `clearSavedSession` (teardown orchestrator) + a thin `loadAndRestore` delegator.
- **auto-save.js 1562 → 868 lines** (−44%; −62% since the split began). Facade unchanged (16 members). Net `autosave-restore-cluster.test.js` (5 tests) baselined green pre-move via a temp facade hook, then repointed. Suite 13 files / 48 green.

**The lesson C taught (apply to F):** a cluster's coupling is real only through the flags that cross the cut. C looked scary but had exactly ONE inbound flag (`isRestoring`) and no calls back into core — so it was a clean move once that flag lived in `AutoSaveState`. **Verify F's actual seams the same way before assuming "coupled = can't move."**

---

## What remains in core — A / F (+ H wiring)

- **A — Save lifecycle (the cohesive core; STAYS):** `saveImmediately`, `debouncedSave`, `doSave`, `scheduleRetry`, `clearDebounce`. This is the intended end-state: A is the save engine, not a leaf.
- **F — Auth-expiry & stash (next extraction candidate):** `writePendingSaveStash`, `clearPendingSaveStash`, `readPendingSaveStash`, `recoverOrphanedStash`, `handleAuthExpired`, `showReauthPrompt`, `attemptReauth`, `flushPendingSave`.
- **H — Wiring (STAYS):** `initialize`.

---

## Cluster F — extraction plan (the concrete next move)

**Verified call-graph in the post-C core (line numbers as of `b9147b9`):**

F splits cleanly into two tiers:

**Tier 1 — pure stash helpers (trivially separable, zero flag coupling):**
- `writePendingSaveStash` (535), `clearPendingSaveStash` (549), `readPendingSaveStash` (554) + the `PENDING_SAVE_KEY` const (63). Pure localStorage. No flags, no DOM, no other-module calls.

**Tier 2 — auth-expiry flow (touches the `authExpired` flag + the retry timer):**
- `recoverOrphanedStash` (184), `handleAuthExpired` (570), `showReauthPrompt` (593), `attemptReauth` (658), `flushPendingSave` (684). `showReauthPrompt` is a self-contained overlay+fetch; the rest orchestrate the stash + re-auth.

**The coupling — F ↔ A is BIDIRECTIONAL (more entangled than C was; this is the crux):**
- `authExpired` — written by F (`handleAuthExpired` 574/575, `attemptReauth` 670, `flushPendingSave` 709), **read by A's `doSave` at 776** (the guard that stashes instead of hitting the server). → Same fix as `isRestoring`: **add `authExpired` to `AutoSaveState`** (getter/setter). Mechanical once C's pattern is in place.
- **F calls INTO A:** `handleAuthExpired` cancels the retry timer (`retryTimer` 578) + calls `clearDebounce` (579); `flushPendingSave` calls `scheduleRetry` (713/717). `retryTimer` / `scheduleRetry` / `clearDebounce` are **Cluster A and should STAY in core** — F should reach them via a small core-exposed seam (e.g. `window.AutoSaveModule`-internal or an `AutoSaveState`/core helper `cancelRetry()` + `scheduleRetry()`), NOT own the timer.
- **A calls INTO F:** `doSave` calls `handleAuthExpired` (804) + `writePendingSaveStash` (778) + `clearPendingSaveStash` (814). → core keeps thin delegators forwarding to `window.AutoSaveAuth` (mirror how core forwards `loadAndRestore` to `AutoSaveRestore`).
- **H calls INTO F:** `initialize` schedules `recoverOrphanedStash` (161). → delegator, same as above.

**Recommended shape:** one new `auto-save-auth.js` (`window.AutoSaveAuth`) holding all 8 F functions + `PENDING_SAVE_KEY`. `authExpired` joins `AutoSaveState`. `retryTimer` + `scheduleRetry` + `clearDebounce` STAY in core (Cluster A); expose whatever minimal seam F needs to schedule/cancel the retry (prefer a named core seam over letting F reach into A's timer). Core keeps delegators for the A→F and H→F inbound calls (`handleAuthExpired`, `writePendingSaveStash`, `clearPendingSaveStash`, `recoverOrphanedStash`). Splitting F's two tiers into separate files is possible but probably not worth it — the stash helpers are only used by the auth flow, so one `auto-save-auth.js` is cohesive.

**Why F is a bit riskier than C:** the bidirectional A↔F coupling means more seams (C had one inbound, no outbound). But each seam is a plain function call, not a shared mutable — so with `authExpired` in `AutoSaveState` and a named retry seam, it's still a MOVE, not a rewrite. Watch the `authExpired` re-entrancy (`handleAuthExpired` is idempotent via the flag; `flushPendingSave` deliberately resets it at 709 to allow re-entry) — the getter/setter must preserve that exact sequencing.

**Characterization net for F (write FIRST, baseline green pre-move):** the stash round-trip (write→read→clear, incl. the `savedAt`/`payload` shape + quota-throw tolerance); `handleAuthExpired` idempotency (second call doesn't re-prompt / re-stash-redundantly) + that it cancels the retry timer; `doSave`'s auth-expired branch (stashes + skips the network when `authExpired`); the `flushPendingSave` success path (clears stash, resets `authExpired`) and its 401-re-entry path. `showReauthPrompt`/`attemptReauth` DOM+fetch are smoke-only (jsdom can't meaningfully exercise the overlay + `/auth/login`).

---

## Strategy options (mostly settled now — kept for context)

The live question is no longer "if/how to touch the shared flags" — C proved the scoped-`AutoSaveState` move works. Remaining choices for F:

1. **Extract F to `auto-save-auth.js` via the plan above (RECOMMENDED).** `authExpired` → `AutoSaveState`; retry seam stays in core; delegators for inbound A→F/H→F. Continues the win; A ends as the cohesive core engine — the intended end-state.
2. **Leave F in core; declare the split done at A+F = the save engine.** Defensible — A and F genuinely collaborate on the save/retry/auth lifecycle. Lowest risk. Choose this if the F seam count feels like it's relocating coupling rather than removing it.
3. **Tier-1 only — extract just the pure stash helpers**, leave the auth flow in core. Smallest safe increment if there's low appetite for the bidirectional seam work.

Old options 2 (big in-place shared-state layer) and 4 (internal reorg only) are effectively retired — C's scoped approach superseded them.

---

## Merge readiness

- Branch `split-monster-acf` (off `origin/main`), commit `b9147b9`, pushed. This branch = E/G/B/D (already on main) + the C extraction.
- Post-split review pass (from the earlier E/G/B/D round): items 2/3/4 (seam audit, facade diff, load-order) CLEAN; item 1 (dup-id sweep) done, 1 bug fixed. Item 5 (real-browser edge-case pass) = **still the last gate before merge**, and now also needs to cover the restore path specifically.
- Suite green (13 files / 48 tests); `node --check` clean on all auto-save files (`auto-save`, `-state`, `-restore`, `-ui`, `-payload`, `-capacity`, `-grading`).
- **Before merge to main:** run the full real-browser edge-case pass — grade → reload → **restore** → edit score → save; multi-tab save/restore; capacity warn/full/dismiss/re-show cycle; form-lock; legacy-restore checkbox scoping; mid-grade refresh (interrupted-restore). jsdom cannot exercise restore timing / multi-tab, so this is mandatory and unautomatable. Then this is mergeable.
