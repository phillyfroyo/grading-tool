/**
 * Regression: Family 1 — refreshHighlightsSection / populateHighlightsContent
 * must act on the caller's tab, not the first same-index match in the document.
 *
 * Both functions resolved their content / `-inner` elements via bare
 * document.getElementById(contentId) / `${contentId}-inner`. contentId is
 * index-bearing (highlights-content-N) and the index restarts per tab, and
 * inactive panes stay in the DOM (toggled by an `active` class, not removed) —
 * so getElementById returned whichever tab's element was first in the document,
 * refreshing/populating the WRONG tab's section. (Both functions already scoped
 * their later student-details / essay-container lookups via TabStore; only these
 * early lookups were missed — same shape as the toggleHighlightsSection fix.)
 *
 * Drives the REAL global refreshHighlightsSection on two same-index tabs and
 * asserts only the ACTIVE tab's `-inner` is touched. The observable is the
 * `dataset.populated` reset the function performs on its resolved `-inner`,
 * which isolates the line-883 lookup without the full populate/render path.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { loadModules } from '../setup/load-module.js';

/** A tab pane with a collapsed index-0 highlights section (content + -inner). */
function makeTabWithRefreshSection(tabId) {
  const pane = document.createElement('div');
  pane.className = 'tab-pane';
  pane.dataset.tabId = tabId;
  pane.innerHTML = `
    <div class="hl-content" style="max-height: 0px;"></div>
    <div class="hl-inner" data-populated="true"></div>`;
  // Colliding index-0 ids via JS; asserts read structurally by class.
  pane.querySelector('.hl-content').id = 'highlights-content-0';
  pane.querySelector('.hl-inner').id = 'highlights-content-0-inner';
  document.body.appendChild(pane);
  return pane;
}

describe('refreshHighlightsSection — tab scoping (Family 1)', () => {
  beforeEach(() => {
    loadModules('public/js/ui/tab-store.js', 'public/js/grading/display-utils.js');
    window.TabStore.clear();
  });

  it('resets the ACTIVE tab’s -inner, leaving another tab’s same-index -inner untouched', () => {
    const tabA = window.TabStore.create();
    const tabB = window.TabStore.create();
    window.TabStore.switchTo(tabB); // make tab B active

    // Tab A (WRONG tab) FIRST in DOM — an un-scoped getElementById grabs it.
    const paneA = makeTabWithRefreshSection(tabA);
    const paneB = makeTabWithRefreshSection(tabB);
    const innerA = paneA.querySelector('.hl-inner');
    const innerB = paneB.querySelector('.hl-inner');

    expect(window.TabStore.activeId()).toBe(tabB);

    window.refreshHighlightsSection('highlights-content-0');

    // Active tab (B) had its populated flag reset …
    expect(innerB.dataset.populated).toBe('false');
    // … other tab (A) untouched.
    expect(innerA.dataset.populated).toBe('true');
  });

  it('control: single rendered tab refreshes correctly', () => {
    const tabId = window.TabStore.activeId(); // clear() left one active tab
    const pane = makeTabWithRefreshSection(tabId);
    const inner = pane.querySelector('.hl-inner');

    window.refreshHighlightsSection('highlights-content-0');

    expect(inner.dataset.populated).toBe('false');
  });
});
