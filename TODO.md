# Grading Tool - TODO

> Last updated: 2026-03-01

---

## 🔴 PRODUCTION BUG: Auto-save only saves 2 of 34 essays

**Reported:** 2026-03-01
**Severity:** Critical — data loss in production

**Problem:** Graded a full class of 34 essays, finished them all. Returned the next morning and auto-save had only preserved 2 essays, not the full batch.

**Evidence from production logs:**
- `[AutoSave] renderedHTML keys: Array(2) lengths: Array(2)` — only 2 essays captured in `renderedHTML` during `buildPayload()`
- `buildPayload essay 0: hasContent=true, length=48874`
- `buildPayload essay 1: hasContent=true, length=40644`
- Only essays 0 and 1 were saved; essays 2–33 were lost.

**Likely cause:** In `auto-save.js` `buildPayload()`, the loop iterates `resultCount` times looking for `document.getElementById('batch-essay-${i}')` elements with non-empty `innerHTML`. The grade detail dropdowns use `max-height: 0; overflow: hidden` (collapsed by default). The DOM elements exist but the content inside (`batch-essay-${i}`) may only get populated when the dropdown is opened via `toggleTab()`. So at save time, only the 2 essays the user had expanded contained rendered HTML — the other 32 had `"Loading formatted result..."` as their innerHTML and were skipped by the `hasContent` check.

**Key files:**
- `public/js/grading/auto-save.js` — `buildPayload()` (line ~468): checks `div.innerHTML.trim() !== 'Loading formatted result...'`
- `public/js/grading/display-utils.js` — `createStudentRowHTML()` (line ~187): initial content is `"Loading formatted result..."`
- The `essaySnapshots` (window globals `essayData_*`) should still contain the data even if the HTML wasn't rendered — need to verify if restore can work from snapshots alone without `renderedHTML`

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
