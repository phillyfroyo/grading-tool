# Multi-Tab Grading Refactor Plan

> **Branch**: `april-2026-tabs`
> **Started**: 2026-04-11
> **Status**: Phase 1 ✓, Phase 2 ✓, Phase 3 ✓, Phase 4 ✓, Phase 5 ✓ (pending browser test) — ready to start Phase 6
> **Estimate**: 5–7 focused sessions

## The feature

Replace the current single-form grading UI with a browser-tab-like interface:

- `[Tab 1 (GPT)] [+]` — `+` button creates a new blank grading tab
- Each tab holds independent state (form inputs, essays, results, teacher notes, highlights, edits)
- Only ONE tab can actively grade at a time — the "Grade Essays" button in other tabs is disabled while any tab is grading
- Users can still switch between tabs freely, view completed results, edit teacher notes, export PDFs, and edit class profiles in any tab while another tab grades
- Tabs persist across page refreshes via the existing auto-save system (all tabs saved together as one JSON blob)
- Claude grading is being removed entirely as part of this refactor (GPT-only from now on)

## Architectural decisions (locked in 2026-04-11)

### Decision 1: State storage → Option A
`window.tabStore` is a keyed object: `{ "tab-1": { currentBatchData, essayData, ... }, "tab-2": {...} }`. A helper `TabStore.active()` returns the currently active tab's state object. Every place that currently reads `window.currentBatchData` or `window.currentGradingData` gets rewritten to read from `TabStore.active()` instead.

Rationale: single source of truth, debuggable from console (`window.tabStore` shows everything), scales to future multi-tab features, avoids subtle timing bugs from swap-based approaches.

### Decision 2: DOM handling → Option A
Each tab has its own DOM subtree wrapped in a `<div class="tab-pane" data-tab-id="tab-N">` container. Tab switching is CSS-driven (show/hide `.active` pane). Full DOM is kept live for all tabs.

Selectors within a tab pane use **class-based scoping**: instead of `#gradingForm`, code uses `getActiveTabPane().querySelector('.grading-form')`. Avoids unique-ID proliferation across the codebase.

Rationale: Option C (rebuild DOM from state on tab switch) was too lossy — in-progress modals, text selections, scroll positions, and event handlers are hard to serialize correctly. Option A matches how real browser tabs work.

### Decision 3: Storage persistence → Option A (no schema changes)
Auto-save continues to write one row per user in `saved_grading_sessions`. The `sessionData` JSON blob grows a `tabs` key containing all tabs' state. `activeTabId` is also stored in the same JSON blob.

Rationale: zero schema changes, zero migrations, access pattern is "load all user tabs at once" which maps 1:1 to a blob.

### Decision 4: Grading lock → Interpretation A
During active grading, only the currently-grading tab can submit. Other tabs' "Grade Essays" buttons are disabled but the tabs themselves remain fully interactive — users can switch to them, edit teacher notes, export PDFs, add essays, paste content, select class profiles, etc. They just can't start a new grading run until the active one finishes.

## User-facing decisions (locked in 2026-04-11)

- **Max tabs**: 10 (soft cap with friendly error on 11th)
- **Close tab**: confirmation dialog if tab has unsaved work
- **Tab naming**: generic auto-names (`Tab 1`, `Tab 2`, ...) with double-click-to-rename support
- **New tab initial state**: fresh empty form (no class profile pre-selected)
- **Kill switch / feature flag**: none — each phase is self-contained and leaves the app fully functional
- **Claude tab**: removed entirely in Phase 1

## Phase plan

Each phase ends with a clean commit. Any phase boundary is a valid stopping point.

### Phase 1: Claude removal — 615 lines deleted ✓ COMPLETE (commit cc91614)
- [x] Delete `grader/grader-claude.js` (354 lines)
- [x] Remove claude-grader tab content from `public/index.html` (60+ lines) — also fixed a latent duplicate-ID bug where both tabs had `id="loading"` and `id="results"`
- [x] Remove provider-switching branches in `src/services/gradingService.js`
- [x] Remove Claude-related logic in `public/js/ui/form-handling.js` (setupClaudeGrading, formId/provider detection, disableInactiveTab/enableAllTabs callers)
- [x] Delete `disableInactiveTab` and `enableAllTabs` entirely from `public/js/ui/tab-management.js` (they were provider-specific; Phase 6 will reintroduce multi-tab lock/unlock with different names)
- [x] Remove `provider` field from all 5 `gradeEssayUnified` call sites and all `req.body` destructures in `src/controllers/gradingController.js`, plus drop from `streamingSessions` state
- [x] Drop `claudeGradingForm` from auto-save form-iteration arrays
- [x] Rename `getClaudeLoadingMessage` → `getLoadingMessage`, `window.claudeMessageTimer` → `window.loadingMessageTimer` (they were always themed loading messages, not Claude-API-coupled)
- [x] Remove `claudeClassProfile` dropdown fallback from display-utils and updateProfileDropdown
- [x] Delete the Claude half of essay-management.js (claudeEssayCount, addClaudeEssay, removeClaudeEssay, renumberClaudeEssays, updateClaudeRemoveButtons + setup wiring)
- [x] Remove Claude-specific CSS rules from components.css
- [ ] Verify single-essay and batch grading still work end-to-end (manual test — user to confirm)

### Phase 2: TabStore module ✓ COMPLETE (commit TBD)
- [x] Create `public/js/ui/tab-store.js` (~300 lines) with the core API:
  - `TabStore.create(initialState)` → returns new tabId
  - `TabStore.active()` → returns active tab's state object
  - `TabStore.activeId()` → returns active tabId
  - `TabStore.switchTo(tabId)` → sets active tab, fires `tab-switched` event
  - `TabStore.close(tabId)` → removes tab from store; auto-creates replacement if closing last tab
  - `TabStore.all()` → returns all tabs as array
  - `TabStore.count()` → returns number of tabs
  - `TabStore.get(tabId)` → returns a specific tab by ID
  - `TabStore.rename(tabId, newLabel)` → renames a tab, fires `tab-renamed`
  - `TabStore.serialize()` → returns JSON-safe representation including activeTabId and nextIdCounter
  - `TabStore.deserialize(data)` → restores tabs from saved data, falls back to fresh tab on malformed input
  - `TabStore.clear()` → removes all tabs and creates a fresh tab-1 (for "Clear & Start Fresh")
- [x] Add `window.TabStore` global using IIFE to keep internal state private
- [x] Document the shape of a tab's state object in the file header
- [x] Script tag added to `index.html` before `tab-management.js`
- [x] Module auto-creates initial tab-1 on load so app is never in zero-tabs state
- [x] Events dispatched on window: `tab-created`, `tab-switched`, `tab-closed`, `tab-renamed`, `tab-store-restored`, `tab-store-cleared`
- [x] Monotonic ID generation (IDs never reused, even after close)
- [x] 38-assertion inline unit test passed: init, create, switchTo, close (active and non-active), close-last auto-replacement, rename (including rejecting whitespace), serialize/deserialize roundtrip with grading data, malformed-data fallback, clear
- [x] No behavior changes yet — infrastructure only (no consumers)

### Phase 3: DOM scoping refactor ✓ COMPLETE (commits 80a007e, 899b817, f2f3593, 811b5c8)
- [x] **Step 3a** (80a007e): Add `TabStore.activePane()`, `activeQuery()`, `activeQueryAll()` helpers to tab-store.js. Wrap the existing grading form in `.tab-pane[data-tab-id="tab-1"]` container in `public/index.html`. The old `tab-content` class is kept alongside for backward compat until Phase 5.
- [x] **Step 3b** (899b817): Migrate already-tab-aware callers that used the legacy `.tab-content.active` pattern to use `TabStore.activeQuery` instead. 7 call sites across `batch-processing.js` and `essay-management.js`.
- [x] **Step 3c** (f2f3593): Migrate the bulk of tab-scoped `getElementById`/`querySelector` calls. 11 files touched, ~50 call sites across form-handling, single-result, grading-display-main, pdf-export, display-utils, profiles, essay-management, event-delegation, batch-processing, highlighting, text-selection.
- [x] **Step 3d** (811b5c8): Second pass to catch missed dynamic-id lookups (batch-essay-N, student-details-N, highlights-tab-N, etc.). 6 files touched, ~30 call sites in auto-save, single-result, display-utils, grading-display-main, highlighting, pdf-export.
- [x] Inline `onclick` handlers audited — no string-level changes needed because the functions they call are now tab-aware by proxy. The user can only click visible elements, and the active tab is guaranteed to be the clicked tab at click time.
- [x] App still has 1 tab and behaves identically, but DOM is structurally prepared for multi-tab. Every tab-scoped getElementById/querySelector resolves through `TabStore.activeQuery` with a `document.*` fallback guard for defense.

Not touched (intentional — these are global, not per-tab):
- Modals (teacherNotesModal, errorModal, confirmationModal, editModal, restoreSessionModal, profileManagementModal)
- Modal internals and highlight-edit UI
- Profile management UI (profilesList, addNewProfileForm, addNewProfileBtn)
- User menu (userDropdown, userEmail, manageProfilesBtn)
- Auto-save banner UI (auto-save-banner, auto-save-status, restoreSession*)
- Legacy manual-grading tab
- Dead code in `public/js/ui/tabs.js` (not loaded by index.html; cleanup deferred)

### Phase 4: Window globals → TabStore migration ✓ COMPLETE (commit 7074729)
- [x] Replace every `window.currentBatchData` read/write with `TabStore.active().currentBatchData` — 8 files, ~15 call sites
- [x] Same for `window.currentGradingData` — 3 files (modals, editing-functions, pdf-export). Note: currentGradingData is actually a module-scoped variable in single-result.js; `window.currentGradingData` was always undefined, so the writes in modals.js/editing-functions.js have always been dead code. Migration follows the pattern anyway to be consistent and set up for future use.
- [x] Same for `window.originalBatchDataForRetry` — form-handling.js (write), batch-processing.js (read), auto-save.js (clear)
- [x] Same for `window.essayData_${i}` (pattern becomes `TabStore.active().essayData[i]`) — 5 files, ~10 call sites. The existing "essayData_N" key format is preserved in the persistence snapshot for backward compat; Phase 7 restructures persistence.
- [x] Same for `window.batchResults` (fallback in pdf-export.js `downloadIndividualEssay` wrapper)
- [x] Introduced `readEssayData(index)` helper in auto-save.js to unify reads across TabStore and legacy window globals
- [x] App still has 1 tab but state now lives in TabStore instead of window globals. All writes go through `TabStore.active()` in normal operation, with legacy window globals as a defensive fallback that should never fire.

### Phase 5: Multi-tab UI ✓ COMPLETE pending browser smoke test (commit b0ac1e3)
- [x] Added `<div class="tab-bar" id="gradingTabBar">` container in index.html (replaces old static tab-buttons).
- [x] Added `<template id="tab-pane-template">` with the empty form structure for cloning into new tab panes.
- [x] CSS for `.tab-bar`, `.tab-item`, `.tab-label`, `.tab-close`, `.tab-add-btn`, `.tab-pane.active`, and the inline-editable `.tab-label.editing` state.
- [x] Rewrote `public/js/ui/tab-management.js` (~330 lines) with:
  - `renderTabBar()` that reads `TabStore.all()` and regenerates the bar DOM
  - `addTab()` that calls `TabStore.create()`, clones the template into a new `.tab-pane`, switches to it, and re-runs per-tab setup functions (`setupMainGrading`, `setupEssayManagement`, `updateProfileDropdown`)
  - `closeTab()` with unsaved-work detection and confirmation modal via `ModalManager.showConfirmation`
  - `switchTab()` that accepts either real tab IDs or the legacy `"gpt-grader"` alias (for auto-save restore compat)
  - `syncPanesToActiveTab()` that toggles `.active` on panes from the `tab-switched` event listener
  - `startRenameTab()` for double-click-to-rename with Enter/Escape/blur handling
  - Delegated click + dblclick handlers on the tab bar
  - 10-tab cap enforced via `MAX_TABS` constant with friendly error message
- [x] Verified with a 12-assertion integration test against a simulated DOM (init, create, switchTo, close, rename, max cap).
- [ ] **Browser smoke test pending** — see "smoke test" notes below.

Not covered in Phase 5 (deferred to later phases):
- **Grading lock** during active grading — deferred to Phase 6. Currently, clicking Grade in one tab does not disable the Grade button in other tabs.
- **Auto-save multi-tab persistence** — deferred to Phase 7. Currently, auto-save only serializes the active tab's state. Refreshing a page with 3 tabs would only restore 1.
- **Class profile dropdown refresh across tabs** — when a profile is saved from one tab, other tabs don't refresh their profile dropdown until the user switches to and interacts with them. Low-priority polish for Phase 5 or later.

### Phase 6: Grading lock — ~50 lines
- [ ] Expose `AutoSaveModule.isGradingInProgress()` getter (1 line)
- [ ] Add `TabManagementModule.lockGradingInAllTabsExcept(tabId)` and `unlockGradingInAllTabs()`
- [ ] Wire into `form-handling.js`: call lock in `markGradingStarted`, unlock in `markGradingFinished`
- [ ] Defense-in-depth guard in submit handler: abort if another tab is grading

### Phase 7: Auto-save multi-tab — ~150 lines modified
- [ ] Change `doSave()` in `auto-save.js` to iterate `TabStore.all()` and serialize each tab's state
- [ ] Change `loadAndRestore()` to populate `TabStore` from the saved blob and activate the previously-active tab
- [ ] Update the restore-prompt modal to reflect multi-tab (probably "Restore your 3 saved tabs?" instead of "Restore your saved session?")
- [ ] Test session-restore flow with multiple tabs

### Phase 8: Testing + bug fixes — ~1 session
- [ ] Open `+` button, verify new tab opens empty
- [ ] Grade in tab 1, verify tab 2+ "Grade Essays" buttons disabled
- [ ] Wait for grading to finish, verify other tabs unlock
- [ ] Switch to tab 2, grade there, verify tab 1's results still intact
- [ ] Switch back to tab 1, verify results visible, teacher notes editable, PDF exportable
- [ ] Refresh browser, verify all tabs restore with correct state and active tab
- [ ] Close a tab with content, verify confirmation dialog fires
- [ ] Close last remaining tab — should auto-create a fresh tab-1 (you should never see 0 tabs)
- [ ] Edit class profile in tab 2 while tab 1 is grading — verify edit doesn't interfere
- [ ] Try to open 11th tab — verify friendly error
- [ ] Rename a tab, verify new name persists across refresh

## Open questions / tricky parts to revisit during implementation

These are expected pause points, not blockers.

### 1. Inline `onclick` handlers with hardcoded indices (Phase 3)
Examples like `<button onclick="removeEssay(0)">`. When there are multiple tabs, `removeEssay(0)` needs to know which tab. Approach TBD until audit — may convert to event delegation, may pass tab context explicitly, may inject tabId into the handler at generation time.

### 2. PDF export + tab switching (Phase 3 or Phase 5)
If user starts a PDF export in tab 1 then switches to tab 2 before the browser print dialog appears, what happens? The current export grabs `document.getElementById('results')` which would hit the wrong tab. Need to either:
- Snapshot the export content synchronously before allowing tab switch, or
- Scope the export to the active tab pane at the moment of invocation

### 3. Highlight editing modal on tab switch (Phase 3 or 5)
If user has the edit-highlight modal open in tab 1 and clicks tab 2, modal should probably auto-close. Need to verify modals are properly scoped/dismissed.

### 4. Restore UX with N tabs (Phase 7)
With 3 tabs open at refresh time, should the restore prompt show:
- "Restore your saved session?" (treats all 3 as one blob)
- "Restore your 3 saved tabs?" (acknowledges multi-tab)
- A list with per-tab options (probably overkill)

Lean toward the second — one restore action, acknowledges the multi-tab reality.

### 5. Class profile dropdown refresh across tabs (Phase 5 or 6)
When tab 2 saves a new class profile, tab 1's dropdown should pick it up when the user switches back. Handle via an event: on profile save, emit `profile-list-changed`, and each tab's profile dropdown listens for it and refreshes.

## Files that will be touched (from investigation)

- `public/js/ui/tab-management.js` — rewrite for dynamic tabs
- `public/js/ui/tab-store.js` — new file
- `public/js/ui/form-handling.js` — scope selectors, add grading lock
- `public/js/ui/modals.js` — scope `currentGradingData` reads
- `public/js/ui/editing-functions.js` — scope `currentGradingData` reads
- `public/js/grading/batch-processing.js` — scope selectors, migrate globals
- `public/js/grading/auto-save.js` — multi-tab persistence
- `public/js/grading/single-result.js` — migrate globals
- `public/js/grading/display-utils.js` — scope selectors
- `public/js/grading/grading-display-main.js` — scope selectors
- `public/js/essay/highlighting.js` — scope selectors
- `public/js/essay-management.js` — scope selectors, tab-aware essay index
- `public/js/pdf-export.js` — scope `currentGradingData` and `batchResults` reads
- `public/js/profiles.js` — add `profile-list-changed` event emit
- `public/index.html` — tab bar, `.tab-pane` wrapper, `+` button
- `public/css/components.css` — tab bar styles
- `grader/grader-claude.js` — DELETE (Phase 1)
- `src/services/gradingService.js` — remove provider branching (Phase 1)
- `src/controllers/gradingController.js` — audit for Claude references (Phase 1)

## Dependencies / prerequisites

- ✓ Vercel Hobby 50MB function size — unaffected (no new backend deps)
- ✓ No database schema changes
- ✓ No new npm packages
- ✓ Backend is already stateless — no server-side changes needed for multi-tab
- ✗ Session restore modal needs UX update for multi-tab (Phase 7)
