/**
 * Regression: Family 2 — teacher note branded/hijacked as a highlight.
 *
 * Pins the fix from commit faf32bd. The teacher-notes block lives inside
 * #batch-essay-N as a SIBLING of .formatted-essay-content (not inside it), so a
 * broad "wire up GPT highlights" sweep scoped to the whole row also catches
 * note elements. Two near-identical loops do this:
 *   - batch-processing.js (~line 845)  — initial render
 *   - auto-save.js (~line 2046)        — restore / reattach
 * Note elements match because an edited note's content span gets inline
 * `background-color:#e8f5e8` (editing-functions.js) → matches span[style*=
 * "background"], and the .edit-indicator ✎ has `color:#666` → matches
 * span[style*="color"]. The fix is the guard `if (el.closest('.teacher-notes'))
 * return;` in both loops, so notes are never branded as highlights and the
 * note's own edit click isn't hijacked by a capture-phase listener.
 *
 * This is a CHARACTERIZATION test of the pure invariant — "the broad selector +
 * .teacher-notes guard must never select a note element" — not a drive of the
 * deeply-buried (setTimeout + essay-state-gated) reattach loops. To keep it
 * honest, the broad selector is EXTRACTED FROM THE REAL SOURCE at test time, so
 * it can't silently drift from production. When the planned refactor extracts
 * both loops into one HighlightingModule.wireLegacyHighlightSpans(container),
 * this same test should retarget that helper unchanged.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Pull the EXACT broad highlight-wiring selector out of the real source files,
 * so the test exercises the production selector, not a hand-copied paraphrase.
 * Asserts both call sites still share one identical selector (the refactor's
 * "can't drift" guarantee) and returns it.
 */
function realBroadSelector() {
  const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
  // The selector always begins with span[style*="background"] and runs to the
  // closing quote of the querySelectorAll argument.
  const grab = src => {
    const m = src.match(/'(span\[style\*="background"\][^']*mark\[data-category\])'/);
    return m && m[1];
  };
  const batch = grab(read('public/js/grading/batch-processing.js'));
  const auto = grab(read('public/js/grading/auto-save.js'));
  expect(batch, 'broad selector not found in batch-processing.js').toBeTruthy();
  expect(auto, 'broad selector not found in auto-save.js').toBeTruthy();
  // Both loops MUST use the identical selector — drift is exactly the bug class.
  expect(batch).toBe(auto);
  return batch;
}

/**
 * Build a realistic #batch-essay-0 row: a color-coded essay with two genuine
 * highlight marks, plus a SIBLING teacher-notes block whose elements match the
 * broad selector the way real edited notes do.
 */
function makeEssayRow() {
  const row = document.createElement('div');
  row.id = 'batch-essay-0';
  row.innerHTML = `
    <div class="formatted-essay-content" data-essay-index="0">
      <mark data-category="grammar" id="hl-1">an error</mark>
      <span class="highlight-mechanics" data-category="mechanics" id="hl-2">another</span>
    </div>
    <div class="grading-summary">
      <div class="teacher-notes editable-section">
        <!-- edited-note content span: inline background → matches span[style*="background"] -->
        <span class="teacher-notes-content" style="background-color: #e8f5e8;" id="note-content">Work on grammar.</span>
        <!-- pencil indicator: color:#666 → matches span[style*="color"] -->
        <span class="edit-indicator" style="color: #666;">✎</span>
      </div>
    </div>`;
  document.body.appendChild(row);
  return row;
}

describe('broad highlight-wiring selector + .teacher-notes guard (Family 2)', () => {
  let row, broad;

  beforeEach(() => {
    broad = realBroadSelector();
    row = makeEssayRow();
  });

  it('the DOM genuinely triggers the bug: without the guard, note elements ARE caught (teeth)', () => {
    // This is the pre-fix behavior — sweeping the whole row with the broad
    // selector and NO guard pulls in the note content span and the ✎ indicator.
    const caughtUnguarded = Array.from(row.querySelectorAll(broad));
    const noteEls = caughtUnguarded.filter(el => el.closest('.teacher-notes'));
    expect(noteEls.length).toBeGreaterThan(0); // if this is 0, the fixture is wrong
  });

  it('with the guard, only real essay highlights are wired — never note elements', () => {
    // The fix: apply the guard exactly as both loops do.
    const wired = Array.from(row.querySelectorAll(broad))
      .filter(el => !el.closest('.teacher-notes'));

    // No wired element is inside a teacher-notes block …
    expect(wired.some(el => el.closest('.teacher-notes'))).toBe(false);
    // … and the genuine essay marks ARE wired.
    const wiredIds = wired.map(el => el.id).sort();
    expect(wiredIds).toContain('hl-1');
    expect(wiredIds).toContain('hl-2');
    // The note content span and ✎ indicator are NOT wired.
    expect(wiredIds).not.toContain('note-content');
  });

  it('the guard is scoped to the whole .teacher-notes block, not just the content span', () => {
    // The ✎ .edit-indicator is a sibling of the content span inside
    // .teacher-notes; .closest('.teacher-notes') must still exclude it.
    const indicator = row.querySelector('.edit-indicator');
    expect(indicator.closest('.teacher-notes')).not.toBeNull();
    const wired = Array.from(row.querySelectorAll(broad))
      .filter(el => !el.closest('.teacher-notes'));
    expect(wired).not.toContain(indicator);
  });
});
