# Large Files Audit — Files Over 400 Lines

> Generated: 2026-04-09
> Last updated: 2026-04-10
> Purpose: Identify refactoring candidates and potential code quality issues ahead of any integration or acquisition discussions.
> Total source files over 400 lines: **17** (was 28; 11 deleted or reduced below threshold as of 2026-04-10)

---

## Frontend — UI/Grading

| Lines | File | Priority | Notes |
|------:|------|----------|-------|
| 1,938 | `public/js/pdf-export.js` | Medium | Was 2,348 lines. Cleaned 2026-04-10: deleted two dead export pipelines (createFallbackPDF chain, createManualExportContent pipeline, removeInteractiveElements) superseded by the openPrintDialog browser-print approach. Remaining active code is well-structured but `openPrintDialog` (585 lines) and `enhanceContentForPDF` (632 lines) are candidates for future splitting. **Architecture note:** The current "print dialog" flow (popup window + `window.print()` + user picks "Save as PDF") is not what commercial products do — users expect a one-click download. Investigated 2026-04-11; the clean long-term fix is server-side headless Chrome (Puppeteer/Playwright) rendering a `/print/essay/:id` route and streaming the PDF back, which would delete ~1,700 lines here. However, we are on **Vercel Hobby**, which has a 50MB unzipped function size limit — `@sparticuz/chromium` fits tightly on Pro but is risky on Hobby — so the server-side option and the third-party service option (DocRaptor/PDFShift/etc.) are both parked for now. Also noted: `html2pdf.js` is loaded from CDN in `index.html` and gated by `isHTML2PDFLoaded()` but is **never actually called** — it's a vestige of the abandoned pipeline and the guard is dead weight. **Deferred path — Option D (client-side spike):** keep the existing content-prep pipeline (`enhanceContentForPDF` and friends) but replace the `openPrintDialog` popup step with `html2pdf(element).outputPdf('blob')` → `URL.createObjectURL` → `<a download>.click()` to produce a real download button with no backend changes. Risk: this is the same library family that originally pushed us to `window.print()` because it couldn't handle colored highlight backgrounds, mid-category page breaks, and live textarea values — `html2pdf.js` has had 4+ years of improvements since, so it may now work, but it's a spike not a guaranteed win. If the spike succeeds, it kills ~1,500 lines (popup management, iframe fallback, inline CSS-in-JS, clone-DOM patching). If it fails, fall back to `window.print()` until we can justify Vercel Pro or an external service. Estimated spike: ~2 hours, no new dependencies (library already loaded). |
| 1,599 | `public/js/essay/highlighting.js` | Low | Was 1,654 lines. Cleaned 2026-04-10: removed 2 dead functions (`removeHighlightFromModal`, `getHighlightsByCategory`), stripped 23 emoji debug console.logs. 95% of code is active. `showHighlightEditModal` (392 lines) is a future candidate for internal splitting. |
| 1,239 | `public/js/grading/display-utils.js` | Low | Was 1,311 lines. Cleaned 2026-04-10: removed 4 dead HTML factories (`createSuccessHTML`, `createWarningHTML`, `createInfoHTML`, `formatColoredScore`), stripped debug logs from `saveEssayToAccount`. Mostly active code — highlights management, student rows, batch results. |
| 1,128 | `public/js/grading/auto-save.js` | Low | Recently refactored (April 2026). Well-structured but large due to feature scope. |
| 1,062 | `public/js/grading/batch-processing.js` | Low | Recently updated (April 2026). Well-structured. |
| 1,025 | `public/js/ui/form-handling.js` | Medium | Handles form submission for single and batch grading, streaming SSE, chunking, queue processing. The streaming/chunking logic could be its own module. |
| 709 | `public/js/grading/grading-display-main.js` | Low | Thin wrapper/coordinator. Size is mostly from legacy backward-compatibility exports. |
| 662 | `public/js/ui/modals.js` | Low | Was 925 lines. Cleaned 2026-04-10: removed dead editHighlight modal code (managed by highlighting.js), dead profile modal code (managed by event-delegation.js/profiles.js), dead eventBus listeners, dead exports. Now contains only teacherNotes, error, and confirmation modal handlers. |
| 464 | `public/js/ui/editing-functions.js` | Low | Was 601 lines. Cleaned 2026-04-10: removed 4 dead functions (`editTransitions`, `editVocabulary`, `editGrammar`, `createInlineEditor`) — all exported but never called. |
| 489 | `public/js/grading/single-result.js` | Low | Was 576 lines. Cleaned 2026-04-10: removed 3 dead exports (`exportGradingData`, `importGradingData`, `validateGradingData`), stripped 20 debug console.logs. |

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
| `single-result.js` | 576 | 489 | 87 | Dead exports (`exportGradingData`, `importGradingData`, `validateGradingData`), 20 debug console.logs |
| `display-utils.js` | 1,311 | 1,239 | 72 | Dead HTML factories (`createSuccessHTML`, `createWarningHTML`, `createInfoHTML`, `formatColoredScore`), debug logs in `saveEssayToAccount` |
| `pdf-export.js` | 2,348 | 1,938 | 410 | Two dead export pipelines (createFallbackPDF chain, createManualExportContent pipeline, removeInteractiveElements) |
| `form-handling.js` | 1,025 | 837 | 188 | Deprecated `streamBatchGrading` (170 lines), dead `updateManualScore` placeholder |
| `highlighting.js` | 1,654 | 1,599 | 55 | Dead functions (`removeHighlightFromModal`, `getHighlightsByCategory`), 23 emoji debug console.logs |

### Bugs fixed during cleanup

- **`profiles.js` duplicate `updateTemperatureDisplay`** — second declaration silently overrode the first, causing temperature display to fail on profile selection. Fixed by consolidating into one function.
- **`modals.js` dual initialization** — `ModalManager.initialize()` was called twice per page load (from `modals.js` self-init AND `ui-interactions-main.js`). Removed the duplicate call.
- **`service-registry.js` double registration** — `eventBus` and `logger` registered in both `dependency-container.js` and `service-registry.js`. Removed the duplicate.
- **`draggable-modal.js` removal broke edit highlight dragging** — the edit highlight modal was managed outside ModalManager, so its draggability depended on the deleted file. Fixed by calling `ModalManager.makeDraggable(modal)` directly in `highlighting.js`.

### Total lines removed: **~6,480**

---

## Remaining Refactor Candidates (by priority)

### Next targets
- All "Next targets" have been cleaned. Remaining work is heavy refactors (see below).

### Heavy refactors (dedicated sessions)
- [ ] **`pdf-export.js` (1,938 lines)** — `openPrintDialog` (585 lines) and `enhanceContentForPDF` (632 lines) are candidates for internal function splitting. Dead code removed; remaining is all active.
  - **Deferred — Option D spike (later session):** replace the popup-based `openPrintDialog` with `html2pdf.js` blob output + `<a download>` click to produce a real one-click download button instead of the current print-dialog flow. `html2pdf.js` is already loaded from CDN in `index.html` but is never called. Keeps `enhanceContentForPDF` content-prep pipeline intact, only swaps the final render step. Potential savings: ~1,500 lines (popup/iframe management, inline CSS-in-JS, print media queries). Risk: same library family that originally failed on colored highlight backgrounds, mid-category page breaks, and live textarea values — needs a 2-hour spike to verify modern `html2pdf.js` handles these. Server-side Puppeteer and third-party PDF services are blocked by Vercel Hobby function size limits + ongoing cost, so Option D is the only path available on current infra.
  - **Cleanup independent of Option D:** the dead `html2pdf` CDN script tag in `index.html` and the `isHTML2PDFLoaded()` guard + polling loop in `pdf-export.js` (~25 lines) can be removed now if we decide not to pursue Option D — they currently serve no purpose. Keep them if Option D is still on the table.
- [ ] **`highlighting.js` (1,599 lines)** — `showHighlightEditModal` (392 lines) could be split into subfunctions (button setup, category rendering, save logic, resize init). Dead code removed; remaining is 95% active.

### Low priority (clean, no action needed)
- `auto-save.js`, `batch-processing.js`, `grading-display-main.js` — recently refactored, well-structured.
- Backend `src/core/` files — individually reasonable, clean separation of concerns.
- HTML/CSS files — functional, not urgent.
