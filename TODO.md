# Grading Tool - TODO

> Last updated: 2026-02-07
> Next work session: ~3 weeks (late Feb / early March 2026)

---

## Highlighting Bugs (Color-Coded Essay Section)

### 1. Overlapping highlight logic — highlights are not independent
**The problem:** When two highlights overlap (share some of the same text), they become entangled. If you remove the second highlight, it also removes or breaks the first one.

**Expected behavior:** Every highlight should be completely independent. You should be able to add, edit, or remove any single highlight without affecting any other highlight, even if they overlap the same words.

**Example:** Suppose the essay says "The quick brown fox." You highlight "quick brown" as error A, then highlight "brown fox" as error B. If you delete error B, error A ("quick brown") should remain intact. Currently, deleting B also removes or corrupts A.

### 2. Adding/removing highlights can corrupt student text
**The problem:** After adding or removing highlights, the student's original essay text sometimes gets altered — words may shift, whitespace may collapse, or line breaks may disappear in the color-coded essay view.

**Expected behavior:** The student's original text should never be modified by the highlighting process. Highlights are a visual overlay — the underlying text must remain exactly as the student wrote it at all times.

### 3. Highlights across formatting gaps don't render + formatting is lost
**The problem (part A — rendering):** When you select text that spans a formatting gap (e.g., a blank line, paragraph break, or line break), the highlight is saved correctly and shows up in the "Highlights & Corrections" section of both the UI and the PDF, but it does **not** appear visually in the color-coded essay view. The highlighted words just look like normal unhighlighted text.

**Example:** Selecting across this gap:
```
Best regards,

Phil
```
The highlight data exists, the correction shows up in the sidebar/PDF, but the color-coded essay doesn't show any highlight color on those words.

**The problem (part B — formatting preservation):** Even when cross-gap highlights do work, the student's original formatting (line breaks, paragraph spacing, indentation) is not preserved in the output. The text gets flattened into a single line or loses its structure, which is confusing for students reading their corrections.

**Expected behavior:** Highlights should render correctly in the color-coded essay regardless of formatting gaps, and all original student formatting (line breaks, blank lines, indentation, spacing) should be preserved everywhere — in the color-coded essay, in the corrections list, and in the PDF.

---

## Performance

### 7. Hover tooltip on highlighted text is too slow
**The problem:** In the color-coded essay, hovering over a highlighted word shows a tooltip with the correction/explanation. This tooltip takes noticeably too long to appear, making it faster to just click the text and open the full edit modal — which defeats the purpose of the tooltip as a quick-glance feature.

**Expected behavior:** The tooltip should appear almost instantly on hover (ideally <100ms delay), so the grader can quickly scan corrections without needing to click into the modal each time.

---

## Feature Ideas

### 4. Drag-to-resize highlights in the Edit Highlight modal
**Current behavior:** To change which words are highlighted, you have to close the modal, clear the highlight, re-select the text with the new range, and re-enter all the correction info.

**Proposed feature:** When opening the "Edit Highlight" modal, the "Highlighted Text:" section should show the highlighted words rendered in their actual highlight color, displayed inline with surrounding non-highlighted context text (a few words before and after). The user can then **drag the left or right edge** of the colored highlight region to expand or shrink the selection — including more or fewer words — without leaving the modal. This makes fine-tuning selections much faster.

### 5. Auto-suggested explanations per error type
**Current behavior:** The grader manually types the explanation for every error, even though many errors of the same type use very similar or identical explanations (e.g., most "subject-verb agreement" errors get a similar explanation).

**Proposed feature:** When the user selects an error type from the dropdown, show a list of **pre-filled explanation suggestions** (either hardcoded common explanations, or populated from previously used explanations for that error type). The grader can pick one with a click or still type a custom explanation. This would save a lot of repetitive typing.

### 6. Spell check in user-added notes
**The problem:** There's no spell checking in the text fields where graders type notes and explanations, so typos can slip into student-facing corrections.

**Proposed feature:** Add red-underline spell check to all user-editable text fields (notes, explanations, correction text, etc.). First try the browser-native `spellcheck="true"` HTML attribute on `<textarea>` / `<input>` / `contenteditable` elements — this may be sufficient with zero dependencies. If not, investigate lightweight JS spell-check libraries.

### 8. Syllabus upload to auto-populate class profiles
**Current behavior:** When creating a class profile, the grader manually enters all the grammar points and vocabulary that students are expected to use in their essays. This is tedious and error-prone, especially for classes with detailed syllabi.

**Proposed feature:** Add an "Upload Syllabus" section to the class profile setup. When a teacher uploads a syllabus (PDF, DOCX, or text), an algorithm parses the document and automatically extracts:
- **Grammar points** the students are expected to use (e.g., past tense, subjunctive, relative clauses)
- **Vocabulary lists** or key terms students should incorporate

The extracted items are presented to the grader for review/editing before being saved to the class profile. This dramatically speeds up class profile creation — instead of manually typing everything, the grader uploads a file and just confirms or tweaks the results.

---

## UI / UX Fixes

### 9. Clarify the temperature control info tooltip
**The problem:** The info tooltip (i icon) next to the temperature control slider does not clearly explain what the setting actually does — specifically, how it algorithmically adjusts the grade.

**Expected fix:** Rewrite the tooltip text to clearly explain in plain language what the temperature control does: how moving the slider up or down affects the AI's grading strictness/leniency, and what that means in practice for the student's final grade. The wording should be understandable to a non-technical teacher.
