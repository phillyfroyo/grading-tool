# Handoff — "Remove all from PDF" cross-tab leak (branch `cleanup-june-2026`)

_2026-06-27. Documents the cross-tab bug, the multi-layer root cause, the four
fixes shipped on this branch, what's still latent, and how to verify/extend._

---

## The reported symptom

Multi-tab grading. **Tab A** has "Remove all from PDF" checked for its essays.
The teacher then grades a **fresh batch in Tab B** and opens an essay's highlights
dropdown. The dropdown shows **every highlight struck through** (the "excluded"
look) — as if remove-all were on — even though **Tab B's own checkbox is
unchecked**. Exporting that essay's PDF could come out blank (all marks excluded).

Because the checkbox now lives hidden inside the dropdown (the June "move
remove-all into the dropdown" change), a stale-looking exclusion is easy to miss,
so this silently strips highlights/corrections the teacher meant to keep.

## Why it was sneaky

There was **no single bug** — the remove-all system leaked across tabs at
**multiple independent layers**, all rooted in the same flaw:

> **The essay index (0, 1, 2, …) is NOT unique across tabs.** Every tab's batch
> restarts the index at 0, so `highlights-tab-content-0` (and the matching
> checkbox id, localStorage key, and `.formatted-essay-content[data-essay-index="0"]`)
> exists in *every* tab. Any lookup that wasn't scoped to a specific tab grabbed
> whichever tab matched **first** in the DOM / localStorage.

Fixing one layer (the visible checkbox) just exposed the next (the marks), which
exposed the next (the dropdown populate readers). Each looked like "the bug came
back" but was a distinct un-scoped lookup.

## Root cause by layer + the fix for each

All four fixes are on `cleanup-june-2026`:

1. **State key collision** (`7cfa29e`). The remove-all state lived in
   `localStorage['removeAllFromPDF_' + contentId]` with an index-only contentId —
   so tab A's `…content-0` and tab B's `…content-0` shared ONE key. **Fix:** scope
   the key by tabId via a single shared helper
   `window.removeAllStorageKey(contentId, tabId)` → `removeAllFromPDF_${tabId}_${contentId}`.
   Every read/write across 5 files routes through it (reads/writes can't disagree).
   Restore passes the EXPLICIT restoring tabId (active tab flips during multi-tab
   restore); batch re-render passes `currentBatchTabId`. Plus a one-time migration
   (`removeAllKeyMigrationV1`) that deletes the old index-only keys.

2. **Marks tagging leak** (`bc35fa2`). `applyRemoveAllStateToMarks` /
   `syncAllRemoveAllStateToMarks` queried **document-wide** for both the checkbox
   and the `.formatted-essay-content` container — so tab A's "on" tagged tab B's
   same-index essay's marks `excludeFromPdf='true'`. **Fix:**
   `applyRemoveAllStateToMarks(essayIndex, tabId)` scopes the storage key, the
   checkbox lookup, and the essay container all via `TabStore.queryInTab(tabId,…)`.
   `syncAllRemoveAllStateToMarks` now iterates `TabStore.all()` and, within each
   tab, that tab's essays (`queryAllInTab`). It only ever SETS `excludeFromPdf`
   (never clears) to preserve manual per-highlight toggles — so marks wrongly
   tagged earlier in a live page clear on next render; new grades are clean.

3. **Duplicate derivation** (`73e7152`, cleanup). The contentId→checkbox-id
   mapping (`highlights-tab-content-N → highlights-tab-N-remove-all`) was
   copy-pasted in 4 places — the same drift risk behind these bugs. **Fix:**
   centralize into `window.removeAllCheckboxId(contentId)`; all 4 callers route
   through it.

4. **Dropdown-populate readers** (`39e3fab`) — THE live recurrence. The console
   diagnostic (below) showed: checkbox unchecked, its localStorage key absent,
   yet the dropdown rendered struck-out — and the active tab's pane had **0 marks**.
   Cause: `loadHighlightsTab`'s **retry-poll** (the essay-not-yet-rendered path)
   used a bare `document.querySelector('.formatted-essay-content[data-essay-index=N]')`.
   Opening a freshly-graded tab's dropdown BEFORE its essay finished rendering
   grabbed ANOTHER tab's same-index essay (remove-all on, marks struck out) and
   built this dropdown's legend from those marks. **Fix:** `loadHighlightsTab`
   pins `scopedTabId = activeId()` once and scopes ALL lookups (initial, retry,
   recursion) to it. `populateHighlightsContent` (the `highlights-content-N`
   grade-details path) likewise scoped via `activeQuery`.

## The diagnostic that cracked it

Run in the browser console on the affected tab with the dropdown open:

```js
(() => {
  const out = {};
  out.localStorage = Object.keys(localStorage)
    .filter(k => k.startsWith('removeAllFromPDF'))
    .map(k => k + ' = ' + localStorage.getItem(k));
  out.activeTabId = window.TabStore && window.TabStore.activeId();
  out.allTabIds = window.TabStore && window.TabStore.all().map(t => t.id);
  const pane = document.querySelector(`.tab-pane[data-tab-id="${out.activeTabId}"]`);
  const marks = pane ? pane.querySelectorAll('.formatted-essay-content mark[data-category], .formatted-essay-content span[data-category]') : [];
  out.markCount = marks.length;
  out.excludedMarks = Array.from(marks).filter(m => m.dataset.excludeFromPdf === 'true').length;
  const cb = pane && pane.querySelector('.remove-all-checkbox');
  out.checkbox = cb ? { id: cb.id, checked: cb.checked, contentId: cb.dataset.contentId } : null;
  console.log(JSON.stringify(out, null, 2)); return out;
})();
```

The tell: `markCount: 0` (this tab has no marks) + checkbox unchecked + struck-out
dropdown ⇒ the legend is being built from a DIFFERENT tab's marks.

## Key symbols (all `display-utils.js` unless noted)

- `removeAllStorageKey(contentId, tabId)` — tab-scoped localStorage key. SINGLE
  source of truth; pass explicit tabId from restore/batch, else defaults to active.
- `removeAllCheckboxId(contentId)` — contentId → checkbox element id. SINGLE source.
- `applyRemoveAllStateToMarks(essayIndex, tabId)` / `syncAllRemoveAllStateToMarks()`
  — tag marks excluded, now per-tab.
- `loadHighlightsTab(index)` (`grading-display-main.js`) — batch dropdown populate;
  pins `scopedTabId`.
- `populateHighlightsContent(contentId)` — single/grade-details dropdown populate;
  `activeQuery`-scoped.

## Still latent (deferred — see ENGINEERING-NOTES "Known issues")

- `setupRemoveAllCheckbox` and `updateRemoveAllCheckboxState` (`display-utils.js`)
  still resolve the checkbox via un-scoped `document.getElementById(\`${contentId}-remove-all\`)`.
  Same "index not unique across tabs" class; held up in active-tab context. Scope
  via `TabStore.queryInTab` when touched.

## Verification (the exact repro)

1. **Hard-reload** (JS is cache-busted by `?v=`; bumps in this work: display-utils
   v46, grading-display-main v20, auto-save v36, editing-functions v25,
   batch-processing v27).
2. Tab A: grade, open a dropdown, check "Remove all from PDF."
3. Tab B: grade a FRESH batch → **immediately open an essay's dropdown** (hit the
   "Loading formatted result…" race) → highlights must render NORMAL (not struck
   out), checkbox unchecked.
4. Repeat a few times — it's a render-timing race, so try opening the dropdown at
   different moments relative to the essay finishing rendering.
5. Export Tab A's PDF → highlights stripped (remove-all still works where set).
   Export Tab B's PDF (after opening to view) → highlights present.

Note: the separate "export before the essay ever rendered → blank PDF (Loading…
placeholder)" is a PRE-EXISTING, unrelated lazy-load behavior, not part of this
issue, and not a real workflow (teachers open to view before exporting).
