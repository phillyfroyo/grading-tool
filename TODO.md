# Grading Tool - TODO

> Last updated: 2026-02-27

---

## ~~1. Spell check in user-added notes~~ DONE
Fixed: Enabled browser-native `spellcheck="true"` on all teacher-facing textareas.

---

## 2. Auto-suggested explanations per error type
**Current behavior:** The grader manually types the explanation for every error, even though many errors of the same type use very similar or identical explanations (e.g., most "subject-verb agreement" errors get a similar explanation).

**Proposed feature:** When the user selects an error type from the dropdown, show a list of **pre-filled explanation suggestions** (either hardcoded common explanations, or populated from previously used explanations for that error type). The grader can pick one with a click or still type a custom explanation. This would save a lot of repetitive typing.

---

## ~~3. Highlights across formatting gaps don't render + formatting is lost~~ DONE
Fixed: Cross-paragraph highlights now split into linked `<mark>` elements sharing a `data-highlight-group` ID. Clicking, saving, removing, and resizing all operate on the full group. Highlights tab, content section, and PDF export deduplicate grouped marks. Tooltip now always shows "Correction: None / Explanation: None" for highlights with no notes.

**Also fixed:** Multi-line corrections/explanations (e.g. multiple correction options separated by newlines) now preserve line breaks in both the on-screen highlights legend and the PDF export. Added HTML entity escaping to PDF export for safety.

---

## 4. Adding/removing highlights can corrupt student text
**The problem:** After adding or removing highlights, the student's original essay text sometimes gets altered — words may shift, whitespace may collapse, or line breaks may disappear in the color-coded essay view.

**Expected behavior:** The student's original text should never be modified by the highlighting process. Highlights are a visual overlay — the underlying text must remain exactly as the student wrote it at all times.

---

## ~~5. Overlapping highlight logic — highlights are not independent~~ DONE
Fixed: Removing a highlight now unwraps its child nodes instead of replacing with flat text, preserving any nested marks from overlapping highlights.

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
