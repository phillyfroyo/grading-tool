/**
 * Regression: Family 1 — essay index is not unique across tabs.
 *
 * Pins the fix from commit bc35fa2 ("tab-scope applyRemoveAllStateToMarks").
 * Every tab's batch restarts the essay index at 0, so `.formatted-essay-content
 * [data-essay-index="0"]` exists in EVERY tab. Before the fix, a remove-all
 * checked in tab A tagged tab B's same-index essay's marks as excludeFromPdf
 * (struck-out highlights → blank PDF in the wrong tab).
 *
 * Loads the REAL tab-store.js (clean, DOM-only, no external deps) and the REAL
 * display-utils.js via eval-into-jsdom — no production-code changes, no stubs
 * for the scoping path. The bug is purely structural DOM-scoping, which jsdom
 * expresses faithfully.
 *
 * EXPECTED: green — the fix is already on main; this test locks it in so the
 * upcoming refactor can't silently reintroduce the leak.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { loadModules } from '../setup/load-module.js';

/** Build a tab pane containing one essay (index 0) with two graded marks. */
function makeTabPane(tabId) {
  const pane = document.createElement('div');
  pane.className = 'tab-pane';
  pane.dataset.tabId = tabId;
  pane.innerHTML = `
    <div class="formatted-essay-content" data-essay-index="0">
      <mark data-category="grammar">an error</mark>
      <mark data-category="mechanics">another</mark>
    </div>`;
  document.body.appendChild(pane);
  return pane;
}

function marksIn(pane) {
  return Array.from(pane.querySelectorAll('mark[data-category]'));
}

describe('applyRemoveAllStateToMarks — tab scoping (Family 1)', () => {
  beforeEach(() => {
    // Real modules; tab-store first so window.TabStore exists at call time.
    loadModules('public/js/ui/tab-store.js', 'public/js/grading/display-utils.js');
  });

  it('tags only the target tab’s marks, leaving the same-index essay in another tab untouched', () => {
    const paneA = makeTabPane('tab-A');
    const paneB = makeTabPane('tab-B');

    // Remove-all is ON for tab B's essay 0 (durable localStorage state, the
    // tab-scoped key format: removeAllFromPDF_<tabId>_<contentId>).
    localStorage.setItem('removeAllFromPDF_tab-B_highlights-tab-content-0', 'true');

    window.applyRemoveAllStateToMarks(0, 'tab-B');

    // Tab B's marks excluded …
    expect(marksIn(paneB).every(m => m.dataset.excludeFromPdf === 'true')).toBe(true);
    // … tab A's same-index marks must be LEFT ALONE (the leak we're guarding).
    expect(marksIn(paneA).some(m => m.dataset.excludeFromPdf === 'true')).toBe(false);
  });

  it('does nothing when the target tab has no remove-all state', () => {
    const paneA = makeTabPane('tab-A');
    // No localStorage key, no checked checkbox → no-op.
    window.applyRemoveAllStateToMarks(0, 'tab-A');
    expect(marksIn(paneA).some(m => m.dataset.excludeFromPdf === 'true')).toBe(false);
  });
});
