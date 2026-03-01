# Grading Tool - TODO

> Last updated: 2026-02-28

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
