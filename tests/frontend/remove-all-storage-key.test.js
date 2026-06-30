/**
 * Regression: Family 1 — remove-all storage key must be tab-scoped (bug 7cfa29e).
 *
 * The remove-all state lives in localStorage. The OLD key was index-only
 * (`removeAllFromPDF_${contentId}` where contentId is `highlights-tab-content-0`
 * etc.), and the essay index resets per tab — so tab A's essay-0 and tab B's
 * essay-0 shared ONE key. Checking remove-all in one tab made the other tab's
 * essay-0 render pre-checked (and it leaked across page loads). The fix routes
 * ALL reads/writes through `removeAllStorageKey(contentId, tabId)` →
 * `removeAllFromPDF_${tabId}_${contentId}`, so the key is unique per essay-per-tab.
 *
 * Tests the REAL helper (display-utils.js) directly — it's on the window surface
 * and dep-light (only window.TabStore.activeId for the default-tab fallback).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { loadModules } from '../setup/load-module.js';

describe('removeAllStorageKey — tab scoping (Family 1, bug 7cfa29e)', () => {
  beforeEach(() => {
    loadModules('public/js/ui/tab-store.js', 'public/js/grading/display-utils.js');
  });

  it('includes the tabId, so same-index essays in different tabs get distinct keys', () => {
    const keyA = window.removeAllStorageKey('highlights-tab-content-0', 'tab-A');
    const keyB = window.removeAllStorageKey('highlights-tab-content-0', 'tab-B');

    expect(keyA).toBe('removeAllFromPDF_tab-A_highlights-tab-content-0');
    expect(keyB).toBe('removeAllFromPDF_tab-B_highlights-tab-content-0');
    // The crux: identical contentId across tabs must NOT collide.
    expect(keyA).not.toBe(keyB);
  });

  it('a write under one tab is invisible to the same contentId under another tab', () => {
    localStorage.setItem(window.removeAllStorageKey('highlights-tab-content-0', 'tab-A'), 'true');

    // Tab A sees its own state …
    expect(localStorage.getItem(window.removeAllStorageKey('highlights-tab-content-0', 'tab-A'))).toBe('true');
    // … tab B's same-index essay does NOT (the cross-tab leak we're guarding).
    expect(localStorage.getItem(window.removeAllStorageKey('highlights-tab-content-0', 'tab-B'))).toBeNull();
  });

  it('falls back to the ACTIVE tab id when tabId is omitted (render/setup call sites)', () => {
    // Render/setup sites call without an explicit tabId and rely on activeId().
    window.TabStore.create();
    const activeId = window.TabStore.activeId(); // the id the helper should pick up
    expect(activeId).toBeTruthy();
    const key = window.removeAllStorageKey('highlights-content-0'); // no tabId arg
    expect(key).toBe(`removeAllFromPDF_${activeId}_highlights-content-0`);
  });
});
