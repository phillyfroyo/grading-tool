/**
 * Regression: reattachHighlightsHandlers' `type === 'content'` branch must scope
 * its remove-all checkbox lookup to the tab being restored, not grab the first
 * same-index match in the document.
 *
 * Found by the post-split dup-id sweep (2026-06-30). On a LEGACY multi-tab
 * restore (old saved sessions that still carry highlightsContentHTML),
 * restoreTabDOM calls reattachHighlightsHandlers(index, container, 'content',
 * tabId) once per essay per tab. The 'content' branch looked the remove-all
 * checkbox up via a bare document.getElementById(`highlights-content-${index}-
 * remove-all`). Those ids repeat across panes (index restarts per tab; inactive
 * panes stay in the DOM), so reattaching tab-2's essay-0 resolved TAB-1's essay-0
 * checkbox — restoring the wrong essay's remove-all state. The sibling 'tab'
 * branch was already scoped via scopedTabId; this mirrors it.
 *
 * The function is private to the auto-save IIFE, exposed for tests as
 * window.AutoSaveModule._reattachHighlightsHandlers. The observable is the
 * `data-setup-complete` attribute the branch removes from the checkbox it
 * resolves — so we assert ONLY the scoped tab's checkbox loses it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadModules } from '../setup/load-module.js';

/** A tab pane carrying an index-0 highlights-content remove-all checkbox
 *  (pre-marked data-setup-complete) plus the -inner container reattach targets. */
function makeContentPane(tabId) {
  const pane = document.createElement('div');
  pane.className = 'tab-pane';
  pane.dataset.tabId = tabId;
  const inner = document.createElement('div');
  inner.className = 'hl-inner';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'remove-all-cb';
  cb.setAttribute('data-setup-complete', 'true');
  pane.appendChild(inner);
  pane.appendChild(cb);
  document.body.appendChild(pane);
  // Duplicate index-0 ids assigned via JS (asserts read by class, not id).
  inner.id = 'highlights-content-0-inner';
  cb.id = 'highlights-content-0-remove-all';
  return { pane, inner, cb };
}

describe('reattachHighlightsHandlers content branch — tab scoping', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.TabStore;
    vi.useFakeTimers(); // reattach defers its work behind a 250ms setTimeout
    loadModules(
      'public/js/ui/tab-store.js',
      'public/js/grading/auto-save-grading.js',
      'public/js/grading/auto-save-ui.js',
      'public/js/grading/auto-save-payload.js',
      'public/js/grading/auto-save.js'
    );
    window.TabStore.clear();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    delete window.TabStore;
  });

  it('reattaching tab-2 essay-0 touches ONLY tab-2 checkbox, not tab-1 same-index', () => {
    // Two tabs, each with an index-0 highlights-content remove-all checkbox.
    const tab1 = makeContentPane('tab-1');
    const tab2 = makeContentPane('tab-2');
    // Register both panes in TabStore so queryInTab can resolve per-tab.
    window.TabStore.deserialize({
      activeTabId: 'tab-1',
      nextIdCounter: 3,
      tabs: [{ id: 'tab-1', label: 'T1' }, { id: 'tab-2', label: 'T2' }],
    });

    // Reattach the CONTENT highlights handlers for tab-2's essay 0.
    window.AutoSaveModule._reattachHighlightsHandlers(0, tab2.inner, 'content', 'tab-2');
    vi.advanceTimersByTime(250); // fire the deferred reattach body

    // The branch removes data-setup-complete from the checkbox it resolves.
    // Scoped correctly → tab-2's loses it; tab-1's keeps it untouched.
    expect(tab2.cb.hasAttribute('data-setup-complete')).toBe(false); // touched (scoped tab)
    expect(tab1.cb.getAttribute('data-setup-complete')).toBe('true'); // untouched (other tab)
  });
});
