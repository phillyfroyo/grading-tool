/**
 * Regression: Family 1 — highlights-dropdown populate must read its OWN tab's
 * marks, never another tab's same-index essay (bug 39e3fab — the live recurrence).
 *
 * `loadHighlightsTab(index)` builds a tab's highlights dropdown from the essay's
 * marks. The essay index is not unique across tabs, so a bare
 * `document.querySelector('.formatted-essay-content[data-essay-index=N]')` would
 * grab whichever tab matched first. If that other tab had remove-all on (marks
 * `excludeFromPdf=true`, struck out), THIS tab's dropdown rendered every entry
 * crossed-out even though its own remove-all is unchecked. The fix pins
 * `scopedTabId = activeId()` once and scopes every lookup (initial, retry,
 * recursion) via `TabStore.queryInTab`.
 *
 * End-to-end test: loads the REAL tab-store.js, display-utils.js (provides the
 * legend renderer `createHighlightsLegendHTML`, which stamps `data-excluded` on
 * each entry) and grading-display-main.js (the function under test). Two tabs,
 * same essay-index 0: tab B's marks are struck out, tab A's are clean. With tab A
 * active, loadHighlightsTab(0) must render tab A's dropdown NOT excluded.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { loadModules } from '../setup/load-module.js';

/**
 * Build a tab pane with an essay (index 0) whose marks may be pre-excluded, and
 * optionally the highlights-tab container that loadHighlightsTab renders into.
 *
 * The CROSS-TAB bug is the essay-index collision: `.formatted-essay-content
 * [data-essay-index="0"]` exists in every tab. The content div (`#highlights-
 * tab-content-0`) is the render TARGET and belongs to the tab being loaded — so
 * only the active tab gets one here (and a single id keeps the DOM valid; jsdom,
 * like real browsers, resolves a scoped `#id` query unreliably when the id is
 * duplicated, which would mask the essay-scoping we're actually testing).
 */
function makeTabWithEssay(tabId, { excluded, withContentDiv = false }) {
  const pane = document.createElement('div');
  pane.className = 'tab-pane';
  pane.dataset.tabId = tabId;
  pane.innerHTML = `
    ${withContentDiv ? '<div id="highlights-tab-content-0"></div>' : ''}
    <div class="formatted-essay-content" data-essay-index="0">
      <mark data-category="grammar" data-original-text="an error">an error</mark>
      <mark data-category="mechanics" data-original-text="another">another</mark>
    </div>`;
  document.body.appendChild(pane);
  // excludeFromPdf is set via JS in production — mirror that.
  if (excluded) {
    pane.querySelectorAll('mark').forEach(m => { m.dataset.excludeFromPdf = 'true'; });
  }
  return pane;
}

/** Read the rendered legend entries' excluded flags out of a tab's content div. */
function renderedExcludedFlags(pane) {
  const entries = pane.querySelectorAll('#highlights-tab-content-0 [data-excluded]');
  return Array.from(entries).map(e => e.getAttribute('data-excluded'));
}

describe('loadHighlightsTab — reads only its own tab’s marks (Family 1, bug 39e3fab)', () => {
  beforeEach(() => {
    loadModules(
      'public/js/categories.js',          // real window.CATEGORIES — the legend renderer needs it
      'public/js/ui/tab-store.js',
      'public/js/grading/display-utils.js',
      'public/js/grading/grading-display-main.js',
    );
    // The tab-store IIFE keeps its tab map + id counter in closure state that
    // persists across re-evals within a file; reset to a known baseline so
    // activeId() is deterministic. clear() leaves one fresh active tab.
    window.TabStore.clear();
  });

  it('builds tab A’s dropdown from tab A’s (clean) marks, not tab B’s struck-out same-index marks', () => {
    // Register both tabs, then switchTo the one we want active — create() only
    // auto-activates when there's no active tab, so don't rely on call order.
    const tabA = window.TabStore.create();
    const tabB = window.TabStore.create();
    window.TabStore.switchTo(tabA);

    // Panes keyed by the SAME data-tab-id TabStore minted. CRITICAL ordering:
    // tab B (the OTHER, struck-out tab) is appended FIRST so it precedes tab A
    // in document order. A document-wide (un-scoped) query returns the first
    // DOM match — i.e. tab B — which is exactly how the bug leaked. With tab A
    // first, an un-scoped query would accidentally still be correct and the
    // test would pass even against broken code (verified: it must fail when
    // scoping is removed).
    makeTabWithEssay(tabB, { excluded: true });                                    // other tab: struck out (FIRST in DOM)
    const paneA = makeTabWithEssay(tabA, { excluded: false, withContentDiv: true }); // active tab: clean (second), has render target

    // Sanity: tab A is the active tab the load will scope to.
    expect(window.TabStore.activeId()).toBe(tabA);

    window.loadHighlightsTab(0);

    const flags = renderedExcludedFlags(paneA);
    // The dropdown rendered (entries exist) …
    expect(flags.length).toBeGreaterThan(0);
    // … and NONE are excluded — we read tab A's clean marks, not tab B's.
    expect(flags.every(f => f === 'false')).toBe(true);
  });

  it('still reflects genuine exclusion when it’s the ACTIVE tab’s own marks that are struck out', () => {
    const tabA = window.TabStore.create();
    window.TabStore.switchTo(tabA);
    const paneA = makeTabWithEssay(tabA, { excluded: true, withContentDiv: true }); // active tab's OWN marks excluded

    window.loadHighlightsTab(0);

    const flags = renderedExcludedFlags(paneA);
    expect(flags.length).toBeGreaterThan(0);
    expect(flags.every(f => f === 'true')).toBe(true); // honest: own exclusion shows
  });
});
