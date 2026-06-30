/**
 * Regression: Family 2 — teacher note branded/hijacked as a highlight.
 *
 * Pins the fix from commit faf32bd, now exercised through the SHARED helper
 * HighlightingModule.wireLegacyHighlightSpans() that the refactor extracted from
 * the two near-identical loops (batch-processing.js initial render + auto-save.js
 * restore). The teacher-notes block lives inside #batch-essay-N as a SIBLING of
 * .formatted-essay-content, so a broad sweep over the whole row also catches note
 * elements: an edited note's content span gets inline background-color:#e8f5e8
 * → matches span[style*="background"], and the .edit-indicator ✎ has color:#666
 * → matches span[style*="color"]. Without the guard `if (el.closest(
 * '.teacher-notes')) return;` those get branded (data-category) and hijacked (a
 * capture-phase click that stopPropagation()'d the note's own edit click).
 *
 * This now drives the REAL helper directly (a strict upgrade over the earlier
 * characterization version): load highlighting.js + categories.js, call
 * wireLegacyHighlightSpans on a realistic row, and assert note elements are
 * never wired (no cursor:pointer, no data-category, no title) while genuine
 * essay marks are.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadModules } from '../setup/load-module.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The broad selector now lives in ONE place — LEGACY_HIGHLIGHT_SELECTOR in
 * highlighting.js (the refactor's "can't drift between paths" guarantee). Pull
 * it from there so the fixture is validated against the real production selector
 * rather than a hand-copied paraphrase, and assert it's the single source.
 */
function singleSourceSelector() {
  const src = fs.readFileSync(path.join(repoRoot, 'public/js/essay/highlighting.js'), 'utf8');
  const m = src.match(/const LEGACY_HIGHLIGHT_SELECTOR\s*=\s*'([^']+)'/);
  expect(m && m[1], 'LEGACY_HIGHLIGHT_SELECTOR not found in highlighting.js').toBeTruthy();
  // The old call sites must no longer carry their own copy of the literal
  // selector — they route through the helper now, so drift is impossible.
  const batch = fs.readFileSync(path.join(repoRoot, 'public/js/grading/batch-processing.js'), 'utf8');
  const auto = fs.readFileSync(path.join(repoRoot, 'public/js/grading/auto-save.js'), 'utf8');
  expect(batch, 'batch-processing.js still has its own broad selector literal')
    .not.toMatch(/'span\[style\*="background"\][^']*mark\[data-category\]'/);
  expect(auto, 'auto-save.js still has its own broad selector literal')
    .not.toMatch(/'span\[style\*="background"\][^']*mark\[data-category\]'/);
  return m[1];
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

/** An element is "wired" if the helper touched it (cursor + click listener). */
function isWired(el) {
  return el.style.cursor === 'pointer';
}

describe('wireLegacyHighlightSpans + .teacher-notes guard (Family 2, real helper)', () => {
  let row, broad;

  beforeEach(() => {
    loadModules('public/js/categories.js', 'public/js/essay/highlighting.js');
    broad = singleSourceSelector();
    row = makeEssayRow();
  });

  it('the fixture genuinely triggers the bug: the broad selector DOES match note elements (teeth)', () => {
    // If this is 0, the fixture no longer reproduces the bug and the guard
    // assertions below would pass vacuously.
    const noteMatches = Array.from(row.querySelectorAll(broad)).filter(el => el.closest('.teacher-notes'));
    expect(noteMatches.length).toBeGreaterThan(0);
  });

  it('restore path (brandCategory off): wires real marks, never note elements', () => {
    window.HighlightingModule.wireLegacyHighlightSpans(row);

    // Genuine essay marks are wired.
    expect(isWired(row.querySelector('#hl-1'))).toBe(true);
    expect(isWired(row.querySelector('#hl-2'))).toBe(true);
    // Note content span and ✎ indicator are NOT wired (no cursor, no listener).
    expect(isWired(row.querySelector('#note-content'))).toBe(false);
    expect(isWired(row.querySelector('.edit-indicator'))).toBe(false);
  });

  it('initial-render path (brandCategory on): brands real marks, never brands notes', () => {
    window.HighlightingModule.wireLegacyHighlightSpans(row, { brandCategory: true });

    // Real marks get a resolved category + title.
    const hl1 = row.querySelector('#hl-1');
    expect(hl1.dataset.category).toBe('grammar');
    expect(hl1.title).toMatch(/Click to edit/);

    // The note content span must NOT be branded — this is the exact corruption
    // the bug produced (note carrying data-category + title like a highlight).
    const note = row.querySelector('#note-content');
    expect(note.title).toBe('');
    expect(isWired(note)).toBe(false);
    // It keeps its legit edited-note background, untouched by the wiring.
    expect(note.style.backgroundColor).toMatch(/232, 245, 232|#e8f5e8/);
  });
});
