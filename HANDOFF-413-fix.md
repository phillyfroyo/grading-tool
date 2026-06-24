# Handoff — 413 autosave payload fix (branch `fix-413-payload`)

_Last updated: 2026-06-24. Written for the next Claude session so work can resume cleanly._

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

## What's left BEFORE merging to prod (the gate)

The user must smoke-test **on the Vercel preview** (not local — the 413 is a Vercel platform limit that doesn't exist locally). Two must-pass checks:

1. **Highlights survive a refresh.** Grade a few essays, add several highlights, let autosave fire (`Save successful` in console), **refresh**, choose **Keep**, reopen highlights → they must all still be there (now regenerated from marks). This is the main correctness risk from the de-dup work.
2. **Payload monitoring renders + saves cleanly.** Capacity chip in tab bar shows live %; grading-complete banner appends "Autosave capacity: X%"; pushing toward the limit (10/tab across tabs) climbs green→amber→red with threshold toasts; **always `Save successful`, never 413**. (With the 10/tab cap, a 413 is now effectively unreachable in normal use — that's the point.)

If both pass → **merge `fix-413-payload` → main → push (Vercel auto-deploys prod).** It's a clean fast-forward:
```
git checkout main && git pull --ff-only origin main
git merge --ff-only fix-413-payload && git push origin main
```

## The PROPER fix (next term, separate branch — do NOT rush for midterms)

The real ceiling-raiser: make highlight edits write back to **structured data** (`inline_issues`) so `renderedHTML` becomes a true cache that can be dropped and re-rendered on restore. That cuts the ~176KB/essay base cost dramatically and makes 30+ essays fit. It touches the **highlight engine** (the riskiest code), so it needs proper design + thorough testing on its own branch (`feat/structured-highlights` suggested). Deferred intentionally — the midterms solution (cap + meter + de-dups) makes the failure mode bounded and well-signposted, which is enough for midterms.

## Key files & symbols

- `public/js/grading/auto-save.js` — `buildPayload`, `gatherTabDOMState` (de-dups), `evaluatePayloadBudget` + `updateCapacityChip` + `getCapacityPercent` + `isPayloadOverBudget` (Layer 3), `showClearButton` (banner capacity line). Constants: `PAYLOAD_CEILING_BYTES = 3_800_000`, `CAPACITY_THRESHOLDS`.
- `public/js/essay-management.js` — `MAX_ESSAYS_PER_TAB = 10`, `addAnotherEssay` (clamp), `updateAddEssayControls` (disable + static note), `activeTabEssayRowCount` (live per-tab count).
- `public/js/ui/form-handling.js` — submit-time silent clamp safety net (`MAX_ESSAYS_PER_TAB = 10` — keep in sync).
- `public/js/essay/text-selection.js` — `applyHighlightToSelection` / `applyBatchHighlightToSelection` block new highlights when `isPayloadOverBudget()`.
- `src/controllers/gradingSessionController.js` + `src/services/gradingSessionService.js` — server save/load (opaque blob; no change needed).
- Restore path: `auto-save.js` `restoreTabDOM` re-renders via `displayBatchResults` (calls `/format`); highlight-HTML restore blocks are guarded (`if (tabData.highlightsTabHTML)`) so absent fields just lazy-regenerate.

## Testing approach used

No test suite in repo. Verification was Playwright harnesses against the served page + Node unit checks of pure logic (budget state machine, threshold hysteresis, cap clamping, tooltip/note state). `node --check` on every edited file. ENV note: the harness tmpfs filled up once — redirect `TMPDIR` to a real-disk dir (e.g. `$PWD/.tmprun`) if Playwright/ENOSPC bites; clean it up after.

## Working-style reminders (from the user, important)

- Always work on a feature branch, never commit to main/prod directly. Commit only when asked. Per-feature commits preferred.
- This app is **acquisition-critical** (the LMS platform the user uses is evaluating acquiring it; North campus adoption during finals is the proof point). Be **cautious with prod**, verify before concluding, don't over-escalate. The user has repeatedly been right to question assumptions — listen.
- Git commits end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. (The committer identity warning on each commit is harmless — auto-derived local name; user hasn't set git config.)
- `.claude/settings.local.json` shows as modified — leave it out of commits.

## Related future work (noted, not started)

- **Admin dashboard** for usage/errors/cost (see memory `admin_dashboard_idea.md`). Blocked on data gaps: no per-event grading log (sessions are overwritten, so lifetime essay counts aren't recoverable), no campus field on `users`, no token/cost capture. First step is instrumentation, not UI.
