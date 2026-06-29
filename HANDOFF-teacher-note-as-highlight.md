# Handoff — Teacher note branded/hijacked as a highlight (branch `cleanup-june-2026`)

_2026-06-29. Documents the "teacher note behaves like a highlight / can't be
edited" bug: the true root cause, the fix, the follow-up cleanup, the diagnostic
console scripts, and what was deliberately NOT done (and why)._

Commits: `faf32bd` (root fix) + `428d35e` (cleanup). Both local on
`cleanup-june-2026`, not pushed at time of writing.

---

## The reported symptoms

Two symptoms, eventually traced to **one** cause:

1. **A teacher note rendered like an essay highlight** — struck-out / grey-tinted,
   its content span carrying `class="highlight-mechanics"`, `data-category=mechanics`,
   a `highlight-<ts>-<rand>` id, and the grey `#D3D3D3` mark tint. Seen on a
   restored tab; a freshly-graded tab looked fine.
2. **"Can't edit the teacher note"** — a real production report from a teacher who
   **always uses "remove all from PDF."** Clicking the note did nothing useful (it
   tried to open the *highlight* editor instead of the note editor). Nobody else
   had reproduced it.

## Why it was sneaky

- The two symptoms looked unrelated (one visual, one interaction) but came from a
  single mechanism.
- It only showed on **restored / heavily-reused** sessions, so it read as an
  "autosave bug that surfaced after days of testing the same essays."
- The "remove all" correlation was real but **misleading** — remove-all is an
  *amplifier*, not the cause (see below).
- Our first hypothesis (and first fix) blamed the highlight-edit Save handler in
  `highlighting.js`. That was a genuine secondary path, but **not the root.** The
  root was elsewhere.

## Root cause

The teacher-notes block lives **inside** `#batch-essay-N`, as a **sibling** of the
color-coded essay (`.formatted-essay-content`) — NOT inside it. So any DOM sweep
scoped to the whole `#batch-essay-N` row also catches teacher-note elements.

Two "wire up GPT highlights" loops did exactly that, with an over-broad selector:

- `public/js/grading/batch-processing.js` (~line 844) — initial render
- `public/js/grading/auto-save.js` (~line 2034) — restore / reattach

Selector (both):
```
span[style*="background"], span[class*="highlight"], span[style*="color"],
mark[data-type], mark.highlighted-segment, mark[data-category]
```

The teacher-note elements match because:
- the **`.edit-indicator` ✎** span is always rendered with `color: #666`
  → matches `span[style*="color"]`, on every render, fresh or not;
- an **edited note's content span** gets inline `background-color: #e8f5e8`
  (the generic "edited" indicator from `makeElementEditable`, editing-functions.js
  ~line 413) → matches `span[style*="background"]`.

For every match, the loops:
1. **force-set `element.dataset.category`** (batch-processing only) → this is the
   visual branding (symptom 1); and
2. **attach a CAPTURE-phase `editHighlight` click listener that calls
   `e.stopPropagation()`** → this swallows the note's own `editTeacherNotes` click
   before it can fire (symptom 2: "can't edit the note").

Because the loops **re-run on every restore**, the corruption survived reloads,
and autosave (which snapshots the whole `#batch-essay-N` innerHTML, auto-save.js
~line 1548) **persisted and replayed** the branded note.

### The "remove all" correlation, explained
Remove-all's own code paths are clean — `applyRemoveAllStateToMarks` /
`syncAllRemoveAllStateToMarks` (display-utils.js) are correctly scoped to
`.formatted-essay-content` and never touch the note; `applyRemoveAllToTeacherNote`
(editing-functions.js) only edits the note's *text*. So remove-all does **not**
brand the note. But a **heavy remove-all user constantly edits notes**, and each
edit leaves the inline `background` that the broad loops latch onto. That's why
only she hit it. Amplifier, not cause.

## The fix

### Root fix (`faf32bd`)
- **`batch-processing.js` + `auto-save.js`** — skip note descendants in both
  broad-selector loops:
  ```js
  if (element.closest('.teacher-notes')) return;
  ```
  This stops both the branding and the capture-phase click hijack. Because the
  loops re-run on restore, it also makes reloads **self-heal**.
- **`auto-save.js`** — scope `ensureHighlightClickHandlers` to
  `.formatted-essay-content` instead of the whole `#batch-essay-N` row.

### Defense-in-depth, same commit (NOT the root, deliberately kept)
- **`highlighting.js`** — `resolveEditingElement(modal)` resolves the highlight-edit
  target via a **direct element reference** (`modal._editingElementRef`), with an
  **active-tab-scoped** id fallback (never bare `document.getElementById`, which is
  not tab-unique), and **refuses `.teacher-notes-content`**. `showHighlightEditModal`
  also refuses to open on a note span.
- **`editing-functions.js`** — `sanitizeTeacherNoteSpan(span)` strips highlight
  branding (`highlight-*` class, `highlight-*` id, mark data-attrs, grey `#D3D3D3`)
  off note spans on every render/restore, **healing already-contaminated saves**.
  ⚠️ It intentionally leaves the `#e8f5e8` green "edited note" tint alone — that's
  legitimate state, not contamination.

### Cleanup follow-up (`428d35e`)
- **`batch-processing.js`** — scope `ensureHighlightClickHandlers` to
  `.formatted-essay-content` too (parity with auto-save; the root fix had only done
  the restore path).
- **`batch-processing.js`** — align its selector with auto-save's (it was missing
  the trailing `mark[data-category]`), so the two near-identical loops can't drift.
- **`highlighting.js`** — add the `.teacher-notes` guard to `migrateLegacyHighlights`
  too: its `span[data-category]` selector is the one remaining loop that can match a
  *contaminated* note span. Don't rely on sanitize running first.

Cache versions bumped across both commits: highlighting **v25**, editing-functions
**v26**, batch-processing **v29**, auto-save **v37**.

## Diagnostic console scripts

Run in the browser DevTools console (hard-reload first — JS is `?v=` cache-busted).

### 1. Check the ACTIVE tab's notes for contamination
```js
(() => {
  const tabId = window.TabStore && window.TabStore.activeId();
  const pane = document.querySelector(`.tab-pane[data-tab-id="${tabId}"]`) || document;
  const notes = pane.querySelectorAll('.teacher-notes-content');
  const report = Array.from(notes).map((n, i) => ({
    noteIndex: i,
    rowId: (n.closest('[id^="batch-essay-"], [id^="student-row-"]') || {}).id,
    contaminated:
      /(^|\s)highlight-/.test(n.className) ||
      /^highlight-/.test(n.id || '') ||
      'category' in n.dataset ||
      /211,\s*211,\s*211|d3d3d3/i.test(n.style.backgroundColor),
    className: n.className,
    id: n.id || '(none)',
    dataCategory: n.dataset.category || '(none)',
    bg: n.style.backgroundColor || '(none)',
    text: (n.textContent || '').slice(0, 60)
  }));
  console.log(JSON.stringify(report, null, 2));
  console.log('CONTAMINATED notes:', report.filter(r => r.contaminated).length);
  return report;
})();
```
**Pass:** `CONTAMINATED notes: 0`.

### 2. Sweep ALL tabs at once
```js
(() => {
  const tabs = (window.TabStore && window.TabStore.all && window.TabStore.all()) || [];
  const all = [];
  (tabs.length ? tabs.map(t => t.id) : [null]).forEach(tabId => {
    const pane = tabId
      ? document.querySelector(`.tab-pane[data-tab-id="${tabId}"]`)
      : document;
    if (!pane) return;
    pane.querySelectorAll('.teacher-notes-content').forEach((n, i) => {
      const bad =
        /(^|\s)highlight-/.test(n.className) ||
        /^highlight-/.test(n.id || '') ||
        'category' in n.dataset ||
        /211,\s*211,\s*211|d3d3d3/i.test(n.style.backgroundColor);
      if (bad) all.push({
        tabId, noteIndex: i,
        className: n.className, id: n.id,
        dataCategory: n.dataset.category, bg: n.style.backgroundColor,
        text: (n.textContent || '').slice(0, 50)
      });
    });
  });
  console.log('Contaminated notes across all tabs:', all.length);
  console.log(JSON.stringify(all, null, 2));
  return all;
})();
```
**Pass:** `Contaminated notes across all tabs: 0`. (This is the real confirmation —
the bug is cross-tab, so sweep all panes, not just the active one.)

### 3. Dump raw outerHTML of any still-bad note (diagnostic, if 1 or 2 is non-zero)
```js
(() => {
  const tabId = window.TabStore && window.TabStore.activeId();
  const pane = document.querySelector(`.tab-pane[data-tab-id="${tabId}"]`) || document;
  const bad = [...pane.querySelectorAll('.teacher-notes-content')].filter(n =>
    /(^|\s)highlight-/.test(n.className) || /^highlight-/.test(n.id || '') ||
    'category' in n.dataset || /211,\s*211,\s*211|d3d3d3/i.test(n.style.backgroundColor)
  );
  console.log(bad.length ? bad.map(e => e.outerHTML).join('\n\n') : '✅ no contaminated notes');
  return bad;
})();
```

### 4. Check for the stale capture-phase click hijacker (the "can't edit" bug) — Chrome only
```js
(() => {
  const tabId = window.TabStore && window.TabStore.activeId();
  const pane = document.querySelector(`.tab-pane[data-tab-id="${tabId}"]`) || document;
  const out = [];
  pane.querySelectorAll('.teacher-notes-content, .edit-indicator').forEach((el) => {
    let clickListeners = '(getEventListeners unavailable — use Chrome)';
    if (typeof getEventListeners === 'function') {
      const l = getEventListeners(el).click || [];
      clickListeners = l.map(x => (x.useCapture ? 'capture' : 'bubble')).join(', ') || '(none)';
    }
    out.push({
      el: el.className,
      rowId: (el.closest('[id^="batch-essay-"]') || {}).id,
      clickListeners,                       // a 'capture' listener on a note = hijacker still attached
      hasCategory: 'category' in el.dataset,
      cursor: getComputedStyle(el).cursor   // 'pointer' on a note span is a tell it was treated as a highlight
    });
  });
  console.table(out);
  return out;
})();
```
**Pass:** no note element shows a `capture` click listener. (Uses
`getEventListeners`, a Chrome DevTools-only function.) The real-world confirmation:
**click the note and confirm it actually opens for editing.**

## Key symbols

- Broad-selector wiring loops (the ROOT): `batch-processing.js` ~844 (initial
  render), `auto-save.js` ~2034 (restore). Both now `.teacher-notes`-guarded.
- `migrateLegacyHighlights` (`highlighting.js` ~1505) — `span[data-category]` loop,
  now guarded.
- `resolveEditingElement` (`highlighting.js` ~843) — direct-ref highlight-edit
  target resolution; refuses notes.
- `sanitizeTeacherNoteSpan` (`editing-functions.js` ~453) — heals branded notes on
  render; called from `setupEditableElements`.
- `makeElementEditable` (`editing-functions.js` ~400) — sets the `#e8f5e8` green
  "edited" tint (legit) and `data-edited="true"`.
- `applyRemoveAllToTeacherNote` (`editing-functions.js`) — note *text* transform
  only; NOT a brander.

## Deliberately NOT done (and why)

These were reviewed during cleanup and intentionally left alone:

1. **Extract the two near-duplicate wiring loops into a shared helper.**
   `batch-processing.js:844` and `auto-save.js:2034` are near-identical (same
   capture-phase `editHighlight` + `stopPropagation` + `mousedown` body; batch also
   sets `title`/`originalText`). They should become ONE helper (e.g.
   `HighlightingModule.wireLegacyHighlightSpans(container)`) so the guard/selector
   can't drift between paths again. **Deferred** — the bodies differ slightly, so
   extracting mid-fix is moderate-risk. The selectors are now aligned and both have
   the guard, so it's safe to defer. Tracked for the planned refactor.

2. **The `highlighting.js` modal guards** (`showHighlightEditModal` note-refusal;
   `resolveEditingElement` `isNote` check). Reviewed as possibly-redundant now that
   the root loops are guarded. **Kept** — they're cheap (`classList.contains`) and
   sit on a path that is only *probably* clean, not provably clean (a contaminated
   `span[data-category]` note could still reach `editHighlight`). Belt-and-suspenders.

3. **`modal.dataset.editingElement` writes** (highlighting.js ~940/967/1183).
   Checked for being dead after the `resolveEditingElement` refactor. **Kept** — the
   value is still READ as the fallback inside `resolveEditingElement` when the direct
   ref is missing/disconnected (e.g. after an innerHTML re-render). Removing them
   would break Save/Remove after a re-render.

4. **The `console.log` in `sanitizeTeacherNoteSpan`** (editing-functions.js ~469).
   **Kept** — gated behind `touched`, so it only logs when it actually heals a note;
   useful telemetry for confirming the heal path in the wild.

5. **The `#e8f5e8` green "edited note" tint.** The sanitizer could strip it (it's
   what makes a note match `span[style*="background"]`), but it's **intentional
   state**, not contamination. The `.teacher-notes` guard makes stripping it
   unnecessary. **Left intact** so the "this note was edited" cue survives.

## Still open (intermittent, undiagnosed — separate from the root fix)

Two residuals reported on the old contaminated note; **not yet reproduced on a
fresh grade** (user testing for the trigger):

1. **Green tint on note edit instead of the note's lavender** — the generic
   `#e8f5e8` editable tint winning over `commitTeacherNote`'s lavender
   (`EDITED_NOTE_BG`). Cosmetic.
2. **Missing "Focus on one category" button** — never diagnosed; likely the restore
   render path not populating `data-teacher-notes-primary`/`-suggestion` (the pill
   needs them). Needs the state-snapshot probe when it reproduces.

When either reproduces, capture **which action produced the bad note** (fresh grade
/ reload / tab-switch / re-grade) plus this snapshot:
```js
(() => {
  const tabId = window.TabStore && window.TabStore.activeId();
  const pane = document.querySelector(`.tab-pane[data-tab-id="${tabId}"]`) || document;
  const blocks = pane.querySelectorAll('.teacher-notes, .teacher-notes.editable-section');
  const out = Array.from(blocks).map((b, i) => {
    const pill = b.closest('.grading-summary')?.querySelector('.teacher-notes-suggestion-btn');
    const content = b.querySelector('.teacher-notes-content');
    return {
      i,
      rowId: (b.closest('[id^="batch-essay-"], [id^="student-row-"]') || {}).id,
      hasPill: !!pill,
      hasPrimary: !!b.dataset.teacherNotesPrimary,
      hasSuggestion: !!b.dataset.teacherNotesSuggestion,
      blockBg: b.style.backgroundColor || '(none)',
      contentBg: content?.style.backgroundColor || '(none)',
      edited: content?.dataset.edited || '(none)'
    };
  });
  console.table(out);
  return out;
})();
```
- Missing Focus button → `hasPrimary`/`hasSuggestion` likely `false` (render path
  never populated the two-version note data).
- Green tint → `contentBg` shows `rgb(232, 245, 232)` (#e8f5e8) instead of lavender.
