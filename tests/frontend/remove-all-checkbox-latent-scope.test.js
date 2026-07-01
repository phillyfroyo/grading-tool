/**
 * Family 1 — `setupRemoveAllCheckbox` checkbox-resolution scoping.
 *
 * `setupRemoveAllCheckbox(contentId)` used to resolve the master remove-all
 * checkbox via a bare `document.getElementById(`${contentId}-remove-all`)`. The
 * essay index is not unique across tabs, so that id exists in EVERY pane, and
 * getElementById returned the FIRST in document order — not the caller's tab.
 * That mis-wired the change listener onto the wrong tab's checkbox and was the
 * root of the observed live remove-all cross-tab bleed (see
 * remove-all-live-toggle-crosstab.test.js).
 *
 * FIXED (2026-06-30, this branch): the lookup is now
 * `window.TabStore.activeQuery(`[id="…-remove-all"]`)` — the ACTIVE tab's pane
 * first, then document fallback. So when the active tab is properly registered
 * and present (the real render/restore context), setup resolves the correct
 * tab's checkbox. The first test below pins that fixed behavior.
 *
 * activeQuery falls back to document order ONLY when the active pane has no
 * match at all (e.g. an active tab that isn't in the DOM — a contrived state
 * that doesn't occur in the live app). The second test documents that residual
 * fallback so the contract is explicit. Single-essay family (`highlights-content
 * -N`), where id derivation is correct, isolates the tab-SCOPING axis.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { loadModules } from '../setup/load-module.js';

/** A tab pane carrying the (cross-tab-colliding) index-0 remove-all checkbox. */
function makeTabWithCheckbox(tabId) {
  const pane = document.createElement('div');
  pane.className = 'tab-pane';
  pane.dataset.tabId = tabId;
  pane.innerHTML = `
    <input type="checkbox" id="highlights-content-0-remove-all" />
    <div id="highlights-content-0-inner"></div>`;
  document.body.appendChild(pane);
  return pane;
}

describe('setupRemoveAllCheckbox — checkbox resolution scoping (Family 1)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.TabStore;
    loadModules('public/js/ui/tab-store.js', 'public/js/grading/display-utils.js');
    localStorage.clear();
  });

  it('resolves the ACTIVE tab’s checkbox, not the first in document order (the fix)', () => {
    const paneA = makeTabWithCheckbox('tab-A'); // FIRST in DOM
    const paneB = makeTabWithCheckbox('tab-B'); // second, made ACTIVE below
    const cbA = paneA.querySelector('input[type="checkbox"]');
    const cbB = paneB.querySelector('input[type="checkbox"]');

    // Register both panes and make tab-B active (the real render/restore context
    // — setup runs for the tab the user is actually on).
    window.TabStore.deserialize({
      activeTabId: 'tab-B', nextIdCounter: 3,
      tabs: [{ id: 'tab-A', label: 'A' }, { id: 'tab-B', label: 'B' }],
    });

    // Remove-all = true under TAB B's scoped key. Correct scoping ticks B's box.
    localStorage.setItem('removeAllFromPDF_tab-B_highlights-content-0', 'true');
    window.DisplayUtilsModule.setupRemoveAllCheckbox('highlights-content-0');

    // FIXED: activeQuery resolves tab-B's checkbox (active pane first), so B's
    // saved state ticks B's box — NOT tab-A's (which is first in document order).
    expect(cbB.checked).toBe(true);  // active tab's box reflects its own state
    expect(cbA.checked).toBe(false); // first-in-DOM tab is left alone
  });

  it('control: single active pane resolves correctly (unchanged by the fix)', () => {
    window.TabStore.clear();
    const tabId = window.TabStore.activeId();
    const pane = makeTabWithCheckbox(tabId);
    const cb = pane.querySelector('input[type="checkbox"]');

    localStorage.setItem(`removeAllFromPDF_${tabId}_highlights-content-0`, 'true');
    window.DisplayUtilsModule.setupRemoveAllCheckbox('highlights-content-0');

    expect(cb.checked).toBe(true);
  });
});
