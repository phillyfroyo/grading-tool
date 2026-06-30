/**
 * Regression: Family 1 — toggleHighlightsSection must act on the caller's tab,
 * not the first same-index match in the document.
 *
 * `toggleHighlightsSection(contentId)` (display-utils.js) resolved its content +
 * arrow elements via bare `document.getElementById(contentId)` /
 * `getElementById(`${contentId}-arrow`)`. contentId is index-bearing
 * (`highlights-content-N`) and the index is not unique across tabs, so in
 * multi-tab mode getElementById returns whichever tab's element is first in the
 * document — collapsing/expanding the WRONG tab's highlights section. (The same
 * function already scopes its later student-details lookup via
 * TabStore.activeQuery; only these early lookups were missed.)
 *
 * Drives the REAL exported global on two same-index tabs and asserts the toggle
 * affects only the ACTIVE tab's content. The collapse path is used (start the
 * active content expanded) so the test exercises only the lookup, not the
 * populate/render path.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { loadModules } from '../setup/load-module.js';

/** A tab pane with an index-0 highlights-content section (+ arrow). */
function makeTabWithHighlightsSection(tabId, { expanded }) {
  const pane = document.createElement('div');
  pane.className = 'tab-pane';
  pane.dataset.tabId = tabId;
  pane.innerHTML = `
    <span class="arrow"></span>
    <div class="hl-content" style="max-height: ${expanded ? '10000px' : '0px'};"></div>`;
  // Give the colliding index-0 ids via JS (kept structural-readable via classes
  // for the asserts; duplicate #id across panes is the bug substrate).
  pane.querySelector('.hl-content').id = 'highlights-content-0';
  pane.querySelector('.arrow').id = 'highlights-content-0-arrow';
  document.body.appendChild(pane);
  return pane;
}

describe('toggleHighlightsSection — tab scoping (Family 1)', () => {
  beforeEach(() => {
    loadModules('public/js/ui/tab-store.js', 'public/js/grading/display-utils.js');
    window.TabStore.clear();
  });

  it('collapses the ACTIVE tab’s section, leaving another tab’s same-index section untouched', () => {
    const tabA = window.TabStore.create();
    const tabB = window.TabStore.create();
    window.TabStore.switchTo(tabB); // make tab B active

    // Tab A (the WRONG tab) is FIRST in DOM — an un-scoped getElementById would
    // grab it. Both start expanded; toggling should collapse only tab B's.
    const paneA = makeTabWithHighlightsSection(tabA, { expanded: true });
    const paneB = makeTabWithHighlightsSection(tabB, { expanded: true });
    const contentA = paneA.querySelector('.hl-content');
    const contentB = paneB.querySelector('.hl-content');

    expect(window.TabStore.activeId()).toBe(tabB);

    window.toggleHighlightsSection('highlights-content-0');

    // Active tab (B) collapsed …
    expect(contentB.style.maxHeight).toBe('0px');
    // … other tab (A) untouched (still expanded).
    expect(contentA.style.maxHeight).toBe('10000px');
  });

  it('control: single rendered tab toggles correctly', () => {
    const tabId = window.TabStore.activeId(); // clear() left one active tab
    const pane = makeTabWithHighlightsSection(tabId, { expanded: true });
    const content = pane.querySelector('.hl-content');

    window.toggleHighlightsSection('highlights-content-0');

    expect(content.style.maxHeight).toBe('0px');
  });
});
