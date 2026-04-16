# Grading Tool - TODO

> Last updated: 2026-04-16

---

## 🟡 OPEN: Prisma connection pool exhaustion during concurrent grading

**Discovered:** 2026-04-11 during Phase 6 multi-tab grading tests
**Severity:** Latent — dev-only symptom so far, but will bite in production
**Branch where observed:** `april-2026-tabs` (but unrelated to the tabs refactor)

**Symptom:** Intermittent `Profile not found` errors during batch grading. The server logs show:

```
prisma:error
Invalid `prisma.class_profiles.findFirst()` invocation:
Timed out fetching a new connection from the connection pool. More info: http://pris.ly/d/connection-pool
(Current connection pool timeout: 10, connection limit: 5)
```

Same profile ID on a subsequent attempt returns `Database search result: FOUND` without the error. The profile exists in the DB and is owned by the correct user — the lookup just times out waiting for a free connection.

**Why it surfaced now:** Phase 6 multi-tab testing fires more rapid consecutive DB-touching requests (auth check + profile lookup per essay + auto-save writes) than single-tab testing ever did. The 5-connection pool saturates under that load. Prod hasn't seen it because real teachers grade one batch at a time, not two-tab stress tests.

**Why it matters for prod:** Once multi-tab grading ships, real users will legitimately start firing more concurrent requests. The pool exhaustion will hit prod eventually, and when it does it presents as a misleading "Profile not found" error instead of the real "DB connection timeout" cause.

**Unknown factors to investigate before fixing:**
- What connection limit does prod Prisma use? Neon/Vercel Postgres may have different pool settings than local dev.
- Is `pgbouncer` or another connection pooler sitting in front of Prisma on prod?
- Does any middleware (auth, profile lookup, session) leak connections by not releasing them?
- Should the connection limit be bumped, or is there a leak to fix first?

**Suggested fix direction (when tackled):**
1. Reproduce reliably: script a multi-tab-like load test against local dev to trigger the timeout.
2. Diagnose: check Prisma's connection usage during the test — is it hitting 5 consistently, or is it leaking over time?
3. Fix the root cause OR bump the pool size appropriately for expected concurrency.
4. **Separately: improve error handling** — when `findProfileById` throws a connection timeout, the backend should either retry once or return a 503 with a "database temporarily unavailable, please retry" message, NOT a misleading "Profile not found".
5. Add monitoring/alerts for connection pool errors in prod.

**Scope:** Out of scope for the multi-tab refactor. File as its own follow-up after the tabs work lands.

---

## ✅ FIXED: Auto-save only saves 2 of N essays (batched streaming)

**Reported:** 2026-03-01
**Fixed:** 2026-04-08 (branch: `april-2026`)
**Severity:** Critical — data loss in production
**Verified:** 2026-04-08 — graded 6 essays, refreshed, all 6 restored correctly

**Root cause (two bugs, one symptom):**

1. **`processBatchResultQueue()` fired `saveImmediately` between chunks.** Batch grading uses `streamBatchGradingSimple` which processes essays in chunks of 2 (`CHUNK_SIZE = 2` in `form-handling.js`). Each chunk's results go through `batchResultQueue`, which is drained by `processBatchResultQueue` on a 3-second stagger. After chunk 0-1's 2 results displayed (~6s), the queue emptied and fired `saveImmediately` thinking the batch was done. But chunks 2-5 hadn't started yet (chunks are sequential). The queue processor had no concept of chunk boundaries — "queue empty" ≠ "batch done."

2. **`buildPayload()`'s reconstruction fallback was sticky.** When that premature save ran, `window.currentBatchData` was still `null` (no chunk had set it). The fallback at `auto-save.js:447` reconstructed a 2-essay `currentBatchData` from `essayData_0` and `essayData_1`, **then wrote it back to `window.currentBatchData`**. From that point forward, every subsequent save saw `currentBatchData.results=2` and saved only 2 essays. Even worse: the post-stream assignment at `form-handling.js:315` (`if (!window.currentBatchData) ...`) was then skipped because the stale 2-essay version was there, so the full 6-essay `streamResult` was never written back.

The diagnostic log that pinpointed this:
```
[AutoSaveDiag] chunk 0-1 done: chunkResult.results=2, allResults=2
[AutoSaveDiag] firing saveImmediately (post-queue-drain +2s)
[AutoSaveDiag] buildPayload entry: currentBatchData.results=null, essayData_* globals=2
[AutoSave] buildPayload: reconstructing currentBatchData from essayData globals
[AutoSaveDiag] chunk 2-3 done: chunkResult.results=2, allResults=4
[AutoSaveDiag] buildPayload entry: currentBatchData.results=2, essayData_* globals=4  ← frozen!
[AutoSaveDiag] streaming done: streamResult.results=6, currentBatchData already set=true (len=2)
[AutoSaveDiag] MISMATCH: ... streamResult has len=6 ... Save will use the pre-existing value!
```

**Secondary bug also fixed:** `countEssayDataGlobals()` had a gap-detection bug — it broke at the first missing `essayData_*` slot, which would truncate the count whenever a failed essay left a gap (since `batch-processing.js:354` only sets globals for `essay.success === true`). Replaced with a full scan that returns `highestIndex + 1`.

**Changes:**

*`public/js/ui/form-handling.js`:*
1. Removed the `saveImmediately` call from `processBatchResultQueue()`. The post-stream save at `handleGradingFormSubmission` (+2s after `streamBatchGradingSimple` resolves) is the single authoritative save trigger.
2. In `streamBatchGradingSimple()`, set `window.currentBatchData = { batchResult: { results: allResults, ... }, originalData: batchData }` incrementally after each chunk completes. This way any debounced save firing mid-batch sees the latest known state and never triggers the reconstruction fallback.
3. Also set `currentBatchData` in the small-batch path (`totalEssays <= CHUNK_SIZE`) for consistency.
4. Added `[AutoSaveDiag]` logs at streaming start, per-chunk completion, streaming done, save trigger source.

*`public/js/grading/auto-save.js`:*
5. Made the `buildPayload()` reconstruction fallback **non-sticky** — it now builds a local `batchDataForPayload` variable for the current save only, instead of writing back to `window.currentBatchData`. Global stays null until streaming legitimately assigns it.
6. Rewrote `countEssayDataGlobals()` to scan all 50 slots without breaking on gaps.
7. Added `source` parameter to `doSave()` so every save is tagged with its trigger origin (`saveImmediately`, `debouncedSave`, `retry`).
8. Added `[AutoSaveDiag]` log at `buildPayload` entry showing `currentBatchData.results` count and `essayData_*` globals count.
9. Added sanity-check log at end of `buildPayload()` that warns loudly if `essaySnapshots < resultCount`.

*Console noise cleanup (see commit for full list):* stripped chatty boot-time logs from `index.html`, `tab-management.js`, `user-menu.js`, `form-handling.js`, `ui-interactions-main.js`, `grading-display-main.js`, `profiles.js`.

**Note:** `[AutoSaveDiag]` logs are intentionally left in place for now. Strip them in a later cleanup pass once the intermittent edit-blocking issue below is either resolved or confirmed unrelated.

---

## ✅ FIXED: Category Breakdown not editable post-restore

**Reported:** 2026-04-08 (reproduced twice, same session)
**Fixed:** 2026-04-08 (commit c03d961 on `april-2026`)
**Verified:** 2026-04-08 — tested with 6-essay batch AND 25-essay batch, all essays editable post-refresh in both runs.

**Root cause confirmed via network-tab inspection of a failing save:**
```
renderedHTML[0..3] → real content (~42KB each, "grading-summary" HTML)
renderedHTML[4]    → "💪 Working hard..."
renderedHTML[5]    → "☕ Brewing thoughts..."
```

The saved `renderedHTML` for essays 4 & 5 contained Claude loading-message placeholders, not real rendered HTML. On restore, those placeholder strings were injected into `batch-essay-${i}`, leaving the Category Breakdown section with no editable score inputs for `reattachHandlers` to wire up.

Why: the grading flow has two stages. Stage 1 (AI grading via SSE) populates `window.essayData_${i}`. Stage 2 (`/format` API call) renders the HTML into the DOM. Stage 2 was triggered lazily by `processBatchResultQueue` on a 3-second per-essay stagger, so when the post-stream save fired `setTimeout(2000)` after streaming ended, essays late in the queue were still mid-`/format` fetch. Their `batch-essay-${i}` div still showed the loading placeholder from `loadEssayDetails:436`, and the save captured that.

**Fix (commit c03d961):**
1. Added `formatCallsExpected` counter and `formatCallsDoneIndices` Set in `batch-processing.js` to track per-batch Stage 2 completions.
2. `markFormatCallComplete(index, reason)` is idempotent per index (Set-based) and called from every completion path: `loadEssayDetails` success/format-error/fetch-error, plus `updateEssayStatus` failure path for essays that never reach `loadEssayDetails`.
3. `waitForAllFormatCalls(timeoutMs = 60000)` polls every 100ms and resolves when all expected completions are in (or at 60s timeout as a safety — never rejects).
4. The post-stream save in `handleGradingFormSubmission` now awaits `waitForAllFormatCalls()` instead of firing on a hardcoded 2s timer. Plus a 300ms buffer for the internal 200ms setTimeout inside `loadEssayDetails` that wires up `setupBatchEditableElements`.
5. Reduced `processBatchResultQueue` stagger from 3000ms → 100ms. The 3s stagger was cosmetic for a UX that doesn't apply (dropdowns are collapsed by default, so users don't see the staggered "pop-in"). At 100ms, `/format` calls fire in near-parallel and the waiter resolves quickly.

---

## 🟡 LATENT BUG: Score override edits lost when essay is collapsed before save

**Discovered:** 2026-04-07 (while investigating the auto-save bug)
**Severity:** Low — narrow edge case, but real data loss when triggered

**Problem:** If a user (1) edits a score on an expanded essay, (2) collapses that essay, (3) waits for the debounced save to fire, then (4) refreshes the page — the score override silently drops on restore.

**Why:** `applyScoreOverrides()` in `auto-save.js:836` runs at restore time and tries to find the score input via `container.querySelector('.score-input[data-category="..."]')`. But for collapsed essays, the `batch-essay-${i}` div still contains "Loading formatted result..." at restore time, so the score input doesn't exist yet. The query returns null and the override is dropped without warning.

**Possible fixes:**
- Defer per-essay score override application until that essay is expanded (hook into `loadEssayDetails`).
- OR, store pending overrides in a module-level map keyed by essay index, and apply them inside the `loadEssayDetails` success callback.
- OR, just log a warning when the input lookup fails so we at least know it happened.

**Key files:**
- `public/js/grading/auto-save.js` — `applyScoreOverrides()` (line ~836)
- `public/js/grading/single-result.js` — `setupBatchEditableElements()` (line ~181, populates `batchGradingData` lazily on expand)
- `public/js/grading/batch-processing.js` — `loadEssayDetails()` (line ~413, the lazy-load entry point)

---

## 🔴 PRODUCTION BUG: Everything below "Summary" line is grayed out

**Reported:** 2026-03-01
**Severity:** Medium — visual/UX issue in production

**Problem:** Everything below the "Summary: 2 successful, 0 failed" line on the UI is slightly grayed out, including the grade detail dropdowns when expanded. Modals that open from the grading area display at normal color/opacity.

**Observations:**
- The gray effect applies to all student rows and their expanded content
- Modals are unaffected because they are appended to `document.body` outside the affected DOM subtree
- The issue has appeared intermittently during local development but was never diagnosed

**Likely cause:** `markStudentComplete()` in `batch-processing.js` (line 698) sets `studentRow.style.opacity = '0.7'` on the `.student-row` element. During auto-save restore, `loadAndRestore()` calls `markStudentComplete(index, true)` for every essay in `sessionData.completedEssays`. If all essays were marked complete before leaving, all rows get `opacity: 0.7` on restore — making everything look grayed out. The CSS `opacity` property is inherited by all child elements (including expanded grade details), which explains why the entire content area looks gray. Modals escape this because they live outside the `.student-row` DOM tree.

**Alternative theory:** There may be a separate CSS rule or inline style applying opacity/filter to a parent container (e.g., `.batch-results` or `.compact-student-list`) that affects all children. Worth inspecting the live DOM in production devtools.

**Key files:**
- `public/js/grading/batch-processing.js` — `markStudentComplete()` (line 689-706)
- `public/js/grading/auto-save.js` — `loadAndRestore()` step 6 (line 201-207)
- `public/js/grading/display-utils.js` — `createStudentRowHTML()` (line 142-240)

---

## 1. Copy button in edit highlight modal
Add a copy icon/button to the edit highlight modal to copy the highlighted student text to the clipboard.

---

## 2. Keyboard highlight resize blocked by focused textbox
In the edit highlight modal, the < > keyboard keys for changing highlight length don't work when a textbox is selected (expected behavior). But clicking on the highlight in the preview doesn't deselect the textbox — only clicking blank space outside the textbox does. Fix it so that clicking the highlight deselects the textbox and selects the highlight, allowing < > keys to work immediately.

---

## 3. Score colors don't update when manually changing grades
When the app returns grades, score colors reflect the value — red for low, yellow for mid, green for high. But when manually editing a score (e.g., changing 3/15 to 15/15), the color stays the same. The color should recalculate based on the new value.

---

## 4. Dial in the /account page and save essay feature
The save essay feature is in beta. Improve the /account page — editing UX, display polish, and reliability.

---

## 5. Nearby highlights visible in edit highlight modal text window
Make nearby/overlapping highlights visible within the text preview window of the edit highlight modal. This unlocks useful new features for managing different highlights that are close by or overlapping.

---

## 6. Admin portal for storing student essays by CEFR level
We need test data to understand the most common errors at each level, which I think would significantly improve output accuracy if implemented correctly. To do this, let's create an admin portal where we store the original student essays at each CEFR level. Our users are only my coworkers for now, and I have already talked to them about this, and they are okay with it.

---

## 7. Syllabus upload to auto-populate class profiles
**Current behavior:** When creating a class profile, the grader manually enters all the grammar points and vocabulary that students are expected to use in their essays. This is tedious and error-prone, especially for classes with detailed syllabi.

**Proposed feature:** Add an "Upload Syllabus" section to the class profile setup. When a teacher uploads a syllabus (PDF, DOCX, or text), an algorithm parses the document and automatically extracts:
- **Grammar points** the students are expected to use (e.g., past tense, subjunctive, relative clauses)
- **Vocabulary lists** or key terms students should incorporate

The extracted items are presented to the grader for review/editing before being saved to the class profile. This dramatically speeds up class profile creation — instead of manually typing everything, the grader uploads a file and just confirms or tweaks the results.
