# Smoke test — Family-1 cross-tab highlights fixes (branch `refactors-june-2026-family1`)

Verifies the 3 fixes: `toggleHighlightsSection`, `populateHighlightsContent`,
`refreshHighlightsSection` now act on the **caller's tab**, not the first
same-index match. Goal: two tabs, each with an essay at **the same index**
(both start at essay 0), and confirm acting on one tab's "Highlights and
Corrections" dropdown does NOT affect the other tab's.

JS is cache-busted — `display-utils.js?v=48` is the version under test.

---

## Setup

1. **Hard-reload** the app (Cmd-Shift-R) so it serves `display-utils.js?v=48`.
   - Confirm in DevTools → Network: `display-utils.js?v=48` (not 47).
2. **Tab A:** grade a batch (or restore a session) so it has at least one essay
   (essay index 0).
3. **Add a second tab (Tab B)** and grade/restore a batch there too, so Tab B
   also has an essay at index 0. (Both tabs having an index-0 essay is the whole
   point — that's the id collision.)

---

## Test 1 — toggle isolation (`toggleHighlightsSection`)

1. Go to **Tab B**, make it active.
2. Click an essay's **"Highlights and Corrections"** header to **expand** its
   dropdown.
3. Switch to **Tab A**. Its same-index essay's "Highlights and Corrections"
   dropdown should be **unchanged** (still collapsed — NOT auto-expanded).
   - ❌ **BUG (pre-fix):** Tab A's section toggles when you act on Tab B's.
   - ✅ **FIXED:** only the tab you clicked in reacts.
4. Collapse it again in Tab B; re-check Tab A is still untouched.

## Test 2 — populate isolation (`populateHighlightsContent`)

1. In **Tab B**, expand the dropdown (this populates it). Note its highlight
   list (the legend entries).
2. Switch to **Tab A**, expand its same-index dropdown.
   - ✅ **FIXED:** Tab A's dropdown shows **Tab A's** essay's highlights, not a
     copy of Tab B's.
   - ❌ **BUG:** Tab A's dropdown is built from Tab B's marks (wrong content,
     possibly struck-out if B had remove-all on).

## Test 3 — refresh isolation (`refreshHighlightsSection`)

1. In **Tab B**, with a dropdown expanded, **edit a highlight** (click a
   highlight in the essay, change its category/text, save) — this fires the
   refresh.
2. Switch to **Tab A**.
   - ✅ **FIXED:** Tab A's same-index dropdown is unaffected by Tab B's edit.
   - ❌ **BUG:** Tab A's dropdown got refreshed/altered by Tab B's edit.

---

## Objective cross-tab check (paste in DevTools console, any time)

Confirms each tab's `highlights-content-0-inner` belongs to ITS OWN pane and
their `populated` state is independent:

```js
(() => {
  const tabs = (window.TabStore?.all?.() || []).map(t => t.id);
  const out = tabs.map(tabId => {
    const pane = document.querySelector(`.tab-pane[data-tab-id="${tabId}"]`);
    const inner = pane?.querySelector('[id="highlights-content-0-inner"]');
    const content = pane?.querySelector('[id="highlights-content-0"]');
    return {
      tabId,
      active: tabId === window.TabStore.activeId(),
      innerBelongsToThisPane: !!inner && pane.contains(inner),
      populated: inner?.dataset.populated ?? '(none)',
      expanded: content ? content.style.maxHeight !== '0px' && content.style.maxHeight !== '' : '(none)',
      legendEntries: inner?.querySelectorAll('[data-excluded]').length ?? 0,
    };
  });
  console.table(out);
  return out;
})();
```

**Pass:** every row shows `innerBelongsToThisPane: true`, and the `populated` /
`expanded` / `legendEntries` values differ per tab according to what you did in
each — i.e. acting on one tab doesn't change another tab's row.

---

## If anything fails

Note **which test**, **which tab reacted wrongly**, and paste the console-table
output. That pinpoints which of the three functions still leaks.
```
```
