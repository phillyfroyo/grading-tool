/**
 * CHARACTERIZATION (documenting) test — Family 1 latent gap, NOT yet fixed.
 *
 * `setupRemoveAllCheckbox(contentId)` (display-utils.js, exported; called on the
 * restore path from auto-save.js) resolves the master remove-all checkbox via a
 * bare `document.getElementById(`${contentId}-remove-all`)`. The essay index is
 * not unique across tabs, so that id (`highlights-content-0-remove-all`) exists
 * in EVERY tab's pane — and getElementById returns the FIRST in document order,
 * not the one in the caller's tab. In the active-tab render context that holds
 * up in practice (the active pane is usually first / the only one rendered),
 * which is why this is classified LATENT, not an observed bug (see
 * ENGINEERING-NOTES "Known issues" → "remaining un-tab-scoped remove-all
 * lookups"). The sibling `updateRemoveAllCheckboxState` has the same un-scoped
 * lookup but is internal-only (not exported), so it isn't directly driven here.
 *
 * This test PINS the current behavior and DOCUMENTS the gap as an executable
 * spec, WITHOUT changing production code. It uses the SINGLE-ESSAY family
 * (`highlights-content-N`), where the naive id derivation is correct — isolating
 * the tab-SCOPING axis and NOT entangling the separately-deferred id-derivation
 * bug (which only affects the `highlights-tab-content-N` batch family).
 *
 * WHEN THE BIG TAB-IDENTITY REFACTOR SCOPES THIS LOOKUP: flip the assertion
 * marked "⮕ FLIP ON FIX" so it requires resolving the CALLER's tab's checkbox,
 * and this becomes the regression test for that fix.
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

describe('setupRemoveAllCheckbox — LATENT cross-tab scope gap (Family 1, documented)', () => {
  beforeEach(() => {
    loadModules('public/js/ui/tab-store.js', 'public/js/grading/display-utils.js');
  });

  it('resolves the checkbox by document order, not the caller’s tab (the latent gap)', () => {
    const paneA = makeTabWithCheckbox('tab-A'); // FIRST in DOM
    const paneB = makeTabWithCheckbox('tab-B'); // second
    // Read each pane's checkbox by structure, not by #id: the id is DUPLICATED
    // across panes (that's the bug substrate), and a scoped `#id` query is
    // unreliable under duplicate ids in jsdom (and loosely in browsers).
    const cbA = paneA.querySelector('input[type="checkbox"]');
    const cbB = paneB.querySelector('input[type="checkbox"]');

    // Persist remove-all = true under TAB B's scoped key. A correctly-scoped
    // setup, called for tab B, would read this and tick TAB B's checkbox.
    localStorage.setItem('removeAllFromPDF_tab-B_highlights-content-0', 'true');

    // The exported function takes only a contentId (no tabId) — it cannot tell
    // which tab it's for, so it resolves the FIRST #...-remove-all in the doc.
    window.DisplayUtilsModule.setupRemoveAllCheckbox('highlights-content-0');

    // ⮕ FLIP ON FIX: today getElementById hits tab A's checkbox first. Since the
    // key is scoped to tab B and the active tab isn't B, the active-tab fallback
    // also doesn't see B's state — so NEITHER box reflects B's intent through
    // this call path. That mismatch IS the gap. After the refactor threads a
    // tabId, this should become: expect(cbB.checked).toBe(true).
    expect(cbB.checked).toBe(false); // the tab we set state for is NOT ticked
    expect(cbA.checked).toBe(false); // and tab A has no state of its own either
  });

  it('control: with only the caller’s tab present + active, it resolves correctly (why it holds up)', () => {
    // Single rendered pane, made active = the in-practice render context. Here
    // the naive lookup + active-tab-scoped storage key agree, so it works —
    // exactly why the gap is latent rather than observed.
    window.TabStore.clear();
    const tabId = window.TabStore.activeId();
    const pane = makeTabWithCheckbox(tabId);
    const cb = pane.querySelector('input[type="checkbox"]');

    localStorage.setItem(`removeAllFromPDF_${tabId}_highlights-content-0`, 'true');
    window.DisplayUtilsModule.setupRemoveAllCheckbox('highlights-content-0');

    expect(cb.checked).toBe(true);
  });
});
