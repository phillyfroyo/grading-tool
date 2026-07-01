/**
 * Regression: Family 1 — the LIVE remove-all toggle bleeds across tabs.
 *
 * OBSERVED bug (reproduced live, 2026-06-30): clicking the "remove all from PDF"
 * checkbox on one tab applied the exclude state to a DIFFERENT tab's highlights.
 *
 * ROOT: setupRemoveAllCheckbox (display-utils.js) resolves the highlights inner
 * container with a bare `document.getElementById(`${contentId}-inner`)`.
 * contentId is index-based (`highlights-content-0`) and the index RESTARTS per
 * tab, so that id exists in EVERY pane; getElementById returns the FIRST in
 * document order. Toggling the active tab's checkbox therefore enumerated the
 * FIRST pane's toggle-buttons and struck out ITS marks. (Mark ids themselves are
 * globally unique — `highlight-<i>-<ts>-<rand>` — so the per-mark lookup was
 * never the leak; enumerating the wrong CONTAINER was.)
 *
 * Two live paths carry the same un-scoped lookup: the initial-apply block (setup
 * runs with the box already checked) and the change-listener (a live click).
 * Both are pinned below.
 *
 * The fix scopes the container/mark lookups to the CHECKBOX'S OWN pane
 * (checkbox.closest('.tab-pane')) via the robust [id="…"] attribute selector,
 * and resolves the checkbox itself within the active pane.
 *
 * EXPECTED: FAILS against pre-fix display-utils.js (the first pane's mark gets
 * excluded when the active pane is a later one), GREEN after the fix.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { loadModules } from '../setup/load-module.js';

/**
 * Build a tab pane with a full remove-all structure for essay index 0:
 *  - a #highlights-content-0-remove-all checkbox (the master toggle)
 *  - a #highlights-content-0-inner container holding one .toggle-pdf-btn whose
 *    data-element-id points at a UNIQUE mark id living in the same pane.
 * The index-based ids (checkbox, inner) intentionally COLLIDE across panes; the
 * mark id is unique (as in production).
 */
function makeRemoveAllPane(tabId, markId) {
  const pane = document.createElement('div');
  pane.className = 'tab-pane';
  pane.dataset.tabId = tabId;
  pane.innerHTML = `
    <div class="formatted-essay-content" data-essay-index="0">
      <mark id="${markId}" data-category="grammar">an error</mark>
    </div>
    <input type="checkbox" id="highlights-content-0-remove-all"
           class="remove-all-checkbox" data-content-id="highlights-content-0" />
    <div id="highlights-content-0-inner">
      <div style="margin: 20px 0">
        <button class="toggle-pdf-btn" data-element-id="${markId}">-</button>
      </div>
    </div>`;
  document.body.appendChild(pane);
  return {
    pane,
    checkbox: pane.querySelector('.remove-all-checkbox'),
    mark: pane.querySelector('mark'),
  };
}

/** Register two panes in TabStore and make `activeTabId` the active one. */
function registerTabs(activeTabId) {
  window.TabStore.deserialize({
    activeTabId,
    nextIdCounter: 3,
    tabs: [{ id: 'tab-1', label: 'T1' }, { id: 'tab-2', label: 'T2' }],
  });
}

describe('setupRemoveAllCheckbox live toggle — cross-tab scoping (Family 1)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.TabStore;
    loadModules('public/js/ui/tab-store.js', 'public/js/grading/display-utils.js');
    window.TabStore.clear();
    localStorage.clear();
  });

  it('a live toggle on the active (second) tab excludes ONLY its marks, leaving the first pane untouched', () => {
    const t1 = makeRemoveAllPane('tab-1', 'highlight-0-111-aaa'); // FIRST in DOM
    const t2 = makeRemoveAllPane('tab-2', 'highlight-0-222-bbb'); // active
    registerTabs('tab-2');

    // Setup wires the change listener onto the active tab's checkbox.
    window.DisplayUtilsModule.setupRemoveAllCheckbox('highlights-content-0');

    // A live toggle on tab-2's checkbox.
    t2.checkbox.checked = true;
    t2.checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    expect(t2.mark.dataset.excludeFromPdf).toBe('true');     // active tab excluded
    expect(t1.mark.dataset.excludeFromPdf).not.toBe('true'); // first pane UNTOUCHED (the leak)
  });

  it('restore path: an explicitly-passed checkbox scopes to ITS pane, not the active tab (multi-tab restore race)', () => {
    // Simulates multi-tab restore: restore resolved tab-1's checkbox via
    // paneForTab, but by the time setup runs (behind a 250ms timeout) the active
    // tab has flipped to tab-2. Passing the checkbox must pin setup to tab-1.
    const t1 = makeRemoveAllPane('tab-1', 'highlight-0-555-eee'); // being restored
    const t2 = makeRemoveAllPane('tab-2', 'highlight-0-666-fff'); // now active
    registerTabs('tab-2'); // active tab flipped AWAY from the one being restored

    localStorage.setItem('removeAllFromPDF_tab-1_highlights-content-0', 'true');
    t1.checkbox.checked = true;

    // Restore passes the tab-1 checkbox it resolved via paneForTab('tab-1').
    window.DisplayUtilsModule.setupRemoveAllCheckbox('highlights-content-0', t1.checkbox);

    expect(t1.mark.dataset.excludeFromPdf).toBe('true');     // restoring tab excluded
    expect(t2.mark.dataset.excludeFromPdf).not.toBe('true'); // active tab UNTOUCHED
  });

  it('initial-apply (box already checked at setup) excludes ONLY the active tab’s marks', () => {
    const t1 = makeRemoveAllPane('tab-1', 'highlight-0-333-ccc'); // FIRST in DOM
    const t2 = makeRemoveAllPane('tab-2', 'highlight-0-444-ddd'); // active
    registerTabs('tab-2');

    // Durable remove-all state for tab-2 + the box pre-checked → setup's
    // initial-apply block runs (not the change listener).
    localStorage.setItem('removeAllFromPDF_tab-2_highlights-content-0', 'true');
    t2.checkbox.checked = true;

    window.DisplayUtilsModule.setupRemoveAllCheckbox('highlights-content-0');

    expect(t2.mark.dataset.excludeFromPdf).toBe('true');     // active tab excluded on setup
    expect(t1.mark.dataset.excludeFromPdf).not.toBe('true'); // first pane UNTOUCHED
  });
});
