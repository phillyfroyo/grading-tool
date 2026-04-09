# Large Files Audit — Files Over 400 Lines

> Generated: 2026-04-09
> Purpose: Identify refactoring candidates and potential code quality issues ahead of any integration or acquisition discussions.
> Total source files over 400 lines: **28**

---

## Frontend — UI/Grading

| Lines | File | Priority | Notes |
|------:|------|----------|-------|
| 2,348 | `public/js/pdf-export.js` | High | Largest file in the codebase by far. Likely extractable into smaller helpers (page layout, header/footer, content rendering, etc.). |
| 1,654 | `public/js/essay/highlighting.js` | High | Second largest. Complex interactive feature (click-to-highlight, edit modal, category management) in one monolithic file. |
| 1,311 | `public/js/grading/display-utils.js` | Medium | HTML generation helpers for batch results, student rows, loading spinners, error displays. Could split by concern. |
| 1,128 | `public/js/grading/auto-save.js` | Low | Recently refactored (April 2026). Includes save/restore logic, form lock/unlock, restore modal orchestration, banner UI. Well-structured but large due to feature scope. |
| 1,062 | `public/js/grading/batch-processing.js` | Low | Recently updated (April 2026). Handles batch display, essay loading, format-call tracking, student completion. Could extract format-call tracking into its own module. |
| 1,025 | `public/js/ui/form-handling.js` | Medium | Handles form submission for single and batch grading, streaming SSE, chunking, queue processing. The streaming/chunking logic could be its own module. |
| 925 | `public/js/ui/modals.js` | Medium | ModalManager class with handlers for teacher notes, edit highlights, error, confirmation. Each modal handler could be a separate file. |
| 709 | `public/js/grading/grading-display-main.js` | Low | Thin wrapper/coordinator that delegates to BatchProcessingModule, SingleResultModule, etc. Size is mostly from legacy backward-compatibility exports. |
| 601 | `public/js/ui/editing-functions.js` | Medium | Inline editing logic for scores, feedback textareas, arrow buttons. |
| 576 | `public/js/grading/single-result.js` | Medium | Single essay display + batch editable elements setup. The batch-specific logic could move to batch-processing.js. |
| 444 | `public/js/ui/manual-grading.js` | Low | Was 471 lines. Cleaned 2026-04-09: removed 2 dead exports (`clearManualResults`, `exportManualResults`). Kept fallback/error-path functions as legitimate safety nets. |

## Frontend — Other

| Lines | File | Priority | Notes |
|------:|------|----------|-------|
| 822 | `public/js/profiles.js` | Medium | Class profile CRUD, form handling, dropdown management. **Known bug: `updateTemperatureDisplay` is declared twice (lines 66 and 89)** — second declaration silently overrides the first in browser script mode. |
| 564 | `public/js/account.js` | Low | Account page logic (saved essays, display, editing). |
| 459 | `public/js/essay-management.js` | Low | Essay counter controls, add/remove essay fields, student name progressive display. |
| ~~676~~ | ~~`public/js/core/monitoring.js`~~ | Deleted | Deleted 2026-04-09. Entirely dead code — `ApplicationMonitor` class loaded as ES6 module but `initialize()` never called (only caller was `main.js` which is never loaded by any HTML page). None of its 20+ methods were ever invoked. |
| ~~591~~ | ~~`public/js/core/error-handler.js`~~ | Deleted | Deleted 2026-04-09. Same situation — `ErrorHandler` class loaded but never initialized. Window globals (`reportError`, `reportCriticalError`, `wrapFunction`) exposed but never called anywhere in the codebase. |

## Frontend — HTML/CSS

| Lines | File | Priority | Notes |
|------:|------|----------|-------|
| 818 | `public/css/components.css` | Low | Single stylesheet for all components. Could split by feature area (modals, forms, grading, highlights) but not urgent. |
| 587 | `public/index.html` | Low | Main app page. Contains inline scripts for tab switching and app initialization. The inline scripts could move to a dedicated init module. |
| 479 | `public/account.html` | Low | Account/saved essays page. |

## Backend

| Lines | File | Priority | Notes |
|------:|------|----------|-------|
| 1,090 | `grader/formatter.js` | Medium | The `/format` endpoint logic that renders grading JSON into HTML. Large because it handles multiple output sections (rubric, corrections, highlights, teacher notes). Could split by section. |
| 848 | `src/controllers/gradingController.js` | Medium | Handles grading API routes (single, batch, streaming). The streaming SSE logic is complex and could be extracted. |
| 844 | `src/core/DTOs.js` | Low | Data Transfer Objects. Size is from having many DTO classes — each is small individually. |
| 794 | `src/core/Validation.js` | Low | Validation rules. Same pattern — many small validators add up. |
| 758 | `src/core/EventSystem.js` | Low | Event bus implementation. Self-contained. |
| 687 | `src/core/Repository.js` | Low | Database access layer via Prisma. |
| 622 | `src/core/ResponseFormatter.js` | Low | API response formatting utilities. |
| 432 | `src/core/Container.js` | Low | Dependency injection container. |

---

## Summary of Action Items

### Investigate immediately
- [x] **`manual-grading.js` vs `manual.js`** — resolved 2026-04-09. Deep investigation revealed `manual.js` (450 lines, ES6 `ManualGradingManager` class) was **entirely dead code** — `initialize()` was never called anywhere, so none of its 18 methods ever ran at runtime. The legacy `manual-grading.js` was the only active file. Fix: deleted `manual.js` entirely, removed its script tag from `index.html`, cleaned 2 dead exports from `manual-grading.js`, and inlined the wrapper implementations in `ui-interactions-main.js` so existing callers in `event-delegation.js` still work. Net: **-477 lines** of dead code removed.
- [x] **`profiles.js` duplicate function** — fixed 2026-04-09. `updateTemperatureDisplay` was declared at line 66 (1 arg) and again at line 89 (2 args). The second silently overrode the first in browser script mode, causing two callers (lines 135, 147) to pass a temperature value as a `profileId` — a live bug where the temperature display silently failed to update on profile selection. Fix: removed the dead first declaration, switched the two broken callers to use `updateProfileTemperatureDisplay` which correctly handles the no-profileId case.

### Refactor candidates (when time allows)
- [ ] **`pdf-export.js` (2,348 lines)** — split into logical sections (page setup, header/footer, content blocks, export triggers).
- [ ] **`highlighting.js` (1,654 lines)** — extract modal handling, category management, and click handlers into separate modules.
- [ ] **`form-handling.js` (1,025 lines)** — extract streaming/chunking/queue logic into a dedicated streaming module.
- [ ] **`modals.js` (925 lines)** — extract per-modal handlers (teacher notes, edit highlight, confirmation) into separate files, keep ModalManager as a thin coordinator.

### Low priority (clean but large)
- [ ] `auto-save.js`, `batch-processing.js`, `grading-display-main.js` — recently refactored, well-structured, large due to legitimate feature scope. Monitor but no immediate action needed.
- [ ] Backend `src/core/` files — individually reasonable in size, clean separation of concerns. No refactor needed unless adding major features.
