# Grading Tool - TODO

> Last updated: 2026-02-27

---

## 1. Spell check in user-added notes
**The problem:** There's no spell checking in the text fields where graders type notes and explanations, so typos can slip into student-facing corrections.

**Proposed feature:** Add red-underline spell check to all user-editable text fields (notes, explanations, correction text, etc.). First try the browser-native `spellcheck="true"` HTML attribute on `<textarea>` / `<input>` / `contenteditable` elements — this may be sufficient with zero dependencies. If not, investigate lightweight JS spell-check libraries.

---

## 2. Auto-suggested explanations per error type
**Current behavior:** The grader manually types the explanation for every error, even though many errors of the same type use very similar or identical explanations (e.g., most "subject-verb agreement" errors get a similar explanation).

**Proposed feature:** When the user selects an error type from the dropdown, show a list of **pre-filled explanation suggestions** (either hardcoded common explanations, or populated from previously used explanations for that error type). The grader can pick one with a click or still type a custom explanation. This would save a lot of repetitive typing.

---

## 3. Highlights across formatting gaps don't render + formatting is lost
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

## 4. Adding/removing highlights can corrupt student text
**The problem:** After adding or removing highlights, the student's original essay text sometimes gets altered — words may shift, whitespace may collapse, or line breaks may disappear in the color-coded essay view.

**Expected behavior:** The student's original text should never be modified by the highlighting process. Highlights are a visual overlay — the underlying text must remain exactly as the student wrote it at all times.

---

## 5. Overlapping highlight logic — highlights are not independent
**The problem:** When two highlights overlap (share some of the same text), they become entangled. If you remove the second highlight, it also removes or breaks the first one.

**Expected behavior:** Every highlight should be completely independent. You should be able to add, edit, or remove any single highlight without affecting any other highlight, even if they overlap the same words.

**Example:** Suppose the essay says "The quick brown fox." You highlight "quick brown" as error A, then highlight "brown fox" as error B. If you delete error B, error A ("quick brown") should remain intact. Currently, deleting B also removes or corrupts A.

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
