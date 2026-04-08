# Grading Tool - TODO

> Last updated: 2026-04-07

---

## ✅ FIXED: Auto-save only saves 2 of 34 essays

**Reported:** 2026-03-01
**Fixed:** 2026-04-07 (branch: `april-2026`)
**Severity:** Critical — data loss in production

**Root cause confirmed:** The data was actually being saved correctly all along via `essaySnapshots` and `currentBatchData` (both unconditional in `buildPayload`). The visible "lost essays" symptom was caused by `renderedHTML` only containing entries for essays the user had expanded (gated on `innerHTML !== 'Loading formatted result...'`). On restore, `displayBatchResults()` rebuilds all 34 student rows from `currentBatchData`, but the 32 collapsed essays show "Loading formatted result..." inside their dropdowns until expanded — at which point `loadEssayDetails()` correctly re-fetches from `/format` because `window.essayData_${i}` is re-injected from the saved snapshots.

**Secondary bug also fixed:** `countEssayDataGlobals()` had a gap-detection bug — it broke at the first missing `essayData_*` slot, which would truncate the count whenever a failed essay left a gap (since `batch-processing.js:354` only sets globals for `essay.success === true`). Replaced with a full scan that returns `highestIndex + 1`.

**Changes (all in `public/js/grading/auto-save.js`):**
1. Rewrote `countEssayDataGlobals()` to scan all 50 slots without breaking on gaps.
2. Removed the noisy per-essay `[AutoSave] buildPayload essay N: hasContent=...` log.
3. Added a single sanity-check log at the end of `buildPayload()` that warns loudly if `essaySnapshots < resultCount` (the only condition that means real pre-persistence data loss).

**Test plan:**
- Grade a small batch (3-5 essays), expand none, refresh — confirm all rows visible and clicking any expands + lazy-loads from `/format`.
- Grade and expand 1-2 essays, refresh — confirm expanded ones show instant rendered HTML, collapsed ones lazy-load.
- Larger batch (15-30 essays) to confirm scaling.
- Devtools console after save should show: `[AutoSave] buildPayload: resultCount=N, essaySnapshots=N, renderedHTML=M (rendered cache is expected to be ≤ snapshots; collapsed essays lazy-load on expand)`

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
