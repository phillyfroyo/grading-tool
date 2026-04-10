# Large Files Audit — Files Over 400 Lines

> Generated: 2026-04-09
> Last updated: 2026-04-10
> Purpose: Identify refactoring candidates and potential code quality issues ahead of any integration or acquisition discussions.
> Total source files over 400 lines: **17** (was 28; 11 deleted or reduced below threshold as of 2026-04-10)

---

## Frontend — UI/Grading

| Lines | File | Priority | Notes |
|------:|------|----------|-------|
| 2,348 | `public/js/pdf-export.js` | High | Largest file in the codebase by far. Likely extractable into smaller helpers (page layout, header/footer, content rendering, etc.). |
| 1,654 | `public/js/essay/highlighting.js` | High | Second largest. Complex interactive feature (click-to-highlight, edit modal, category management) in one monolithic file. |
| 1,311 | `public/js/grading/display-utils.js` | Medium | HTML generation helpers for batch results, student rows, loading spinners, error displays. Could split by concern. |
| 1,128 | `public/js/grading/auto-save.js` | Low | Recently refactored (April 2026). Well-structured but large due to feature scope. |
| 1,062 | `public/js/grading/batch-processing.js` | Low | Recently updated (April 2026). Well-structured. |
| 1,025 | `public/js/ui/form-handling.js` | Medium | Handles form submission for single and batch grading, streaming SSE, chunking, queue processing. The streaming/chunking logic could be its own module. |
| 709 | `public/js/grading/grading-display-main.js` | Low | Thin wrapper/coordinator. Size is mostly from legacy backward-compatibility exports. |
| 662 | `public/js/ui/modals.js` | Low | Was 925 lines. Cleaned 2026-04-10: removed dead editHighlight modal code (managed by highlighting.js), dead profile modal code (managed by event-delegation.js/profiles.js), dead eventBus listeners, dead exports. Now contains only teacherNotes, error, and confirmation modal handlers. |
| 464 | `public/js/ui/editing-functions.js` | Low | Was 601 lines. Cleaned 2026-04-10: removed 4 dead functions (`editTransitions`, `editVocabulary`, `editGrammar`, `createInlineEditor`) — all exported but never called. |
| 576 | `public/js/grading/single-result.js` | Medium | Single essay display + batch editable elements setup. The batch-specific logic could move to batch-processing.js. |

## Frontend — Other

| Lines | File | Priority | Notes |
|------:|------|----------|-------|
| 628 | `public/js/profiles.js` | Low | Was 822 lines. Cleaned 2026-04-10: removed dead legacy modal form system (showProfileForm, hideProfileForm, handleProfileFormSubmission — DOM elements no longer exist), consolidated temperature display functions, cleaned debug logs. Ready for syllabus upload feature. |
| 564 | `public/js/account.js` | Low | Account page logic (saved essays, display, editing). |
| 459 | `public/js/essay-management.js` | Low | Essay counter controls, add/remove essay fields, student name progressive display. |
| 444 | `public/js/ui/manual-grading.js` | Low | Was 471 lines. Cleaned 2026-04-09: removed 2 dead exports. |

## Frontend — HTML/CSS

| Lines | File | Priority | Notes |
|------:|------|----------|-------|
| 818 | `public/css/components.css` | Low | Single stylesheet. Could split by feature area but not urgent. |
| 587 | `public/index.html` | Low | Main app page. Inline scripts could move to a dedicated init module. |
| 479 | `public/account.html` | Low | Account/saved essays page. |

## Backend

| Lines | File | Priority | Notes |
|------:|------|----------|-------|
| 1,090 | `grader/formatter.js` | Medium | The `/format` endpoint logic. Could split by output section (rubric, corrections, highlights, teacher notes). |
| 848 | `src/controllers/gradingController.js` | Medium | Grading API routes (single, batch, streaming). The streaming SSE logic could be extracted. |
| 844 | `src/core/DTOs.js` | Low | Many small DTO classes. Individually reasonable. |
| 794 | `src/core/Validation.js` | Low | Many small validators. |
| 758 | `src/core/EventSystem.js` | Low | Event bus implementation. Self-contained. |
| 687 | `src/core/Repository.js` | Low | Database access layer via Prisma. |
| 622 | `src/core/ResponseFormatter.js` | Low | API response formatting utilities. |
| 432 | `src/core/Container.js` | Low | Dependency injection container. |

---

## Completed Work

### Files deleted (2026-04-09 — 2026-04-10)

| File | Lines | Reason |
|------|------:|--------|
| `public/js/grading/manual.js` | 450 | Dead code — `ManualGradingManager` class never initialized. |
| `public/js/core/monitoring.js` | 676 | Dead code — `ApplicationMonitor` never initialized. |
| `public/js/core/error-handler.js` | 591 | Dead code — `ErrorHandler` never initialized. |
| `public/main.js` | 269 | Dead entry point for unused Vite architecture. |
| `public/js/ui/keyboard-shortcuts.js` | 42 | All functions were empty disabled stubs. |
| `public/js/ui/draggable-modal.js` | 128 | Duplicate of `modals.js` `makeDraggable()`. |
| `public/js/essay-editing.js.backup` | 516 | Pre-refactor backup. |
| `public/js/grading-display.js.backup` | 451 | Pre-refactor backup. |
| `public/js/ui-interactions.js.backup` | 1,273 | Pre-refactor backup. |
| 3 file-sync duplicates | ~30 | `.claude/settings.local 2.json`, `docs/CLAUDE_TOKEN_USAGE 2.md`, `grader/grader-claude 2.js` |

### Files cleaned (2026-04-09 — 2026-04-10)

| File | Before | After | Removed | What was removed |
|------|-------:|------:|--------:|------------------|
| `profiles.js` | 822 | 628 | 194 | Dead legacy modal form system, duplicate temperature function, debug logs |
| `modals.js` | 925 | 662 | 263 | Dead editHighlight/profile modal code, dead eventBus listeners, dead exports |
| `manual-grading.js` | 471 | 444 | 27 | Dead exports (`clearManualResults`, `exportManualResults`) |
| `editing-functions.js` | 601 | 464 | 137 | Dead functions (`editTransitions`, `editVocabulary`, `editGrammar`, `createInlineEditor`) |

### Bugs fixed during cleanup

- **`profiles.js` duplicate `updateTemperatureDisplay`** — second declaration silently overrode the first, causing temperature display to fail on profile selection. Fixed by consolidating into one function.
- **`modals.js` dual initialization** — `ModalManager.initialize()` was called twice per page load (from `modals.js` self-init AND `ui-interactions-main.js`). Removed the duplicate call.
- **`service-registry.js` double registration** — `eventBus` and `logger` registered in both `dependency-container.js` and `service-registry.js`. Removed the duplicate.
- **`draggable-modal.js` removal broke edit highlight dragging** — the edit highlight modal was managed outside ModalManager, so its draggability depended on the deleted file. Fixed by calling `ModalManager.makeDraggable(modal)` directly in `highlighting.js`.

### Total lines removed: **~5,070**

---

## Remaining Refactor Candidates (by priority)

### Next targets
- [ ] **`single-result.js` (576 lines)** — batch-specific logic could consolidate with `batch-processing.js`.

### Heavy refactors (dedicated sessions)
- [ ] **`pdf-export.js` (2,348 lines)** — split into logical sections. High risk, core feature.
- [ ] **`highlighting.js` (1,654 lines)** — extract modal handling, category management. High risk, core feature.
- [ ] **`display-utils.js` (1,311 lines)** — split HTML generators by concern.
- [ ] **`form-handling.js` (1,025 lines)** — extract streaming/chunking logic.

### Low priority (clean, no action needed)
- `auto-save.js`, `batch-processing.js`, `grading-display-main.js` — recently refactored, well-structured.
- Backend `src/core/` files — individually reasonable, clean separation of concerns.
- HTML/CSS files — functional, not urgent.
