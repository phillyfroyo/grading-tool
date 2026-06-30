/**
 * Render-path contract net (originally Phase 0 of DESIGN-unify-render-paths.md).
 *
 * The single-essay render path (createSingleEssayHTML / displayResults /
 * toggleHighlightsSection / the bare `highlights-content` scheme) was DELETED:
 * it was dead code — the manual-grading UI that was its only entry was removed
 * from index.html long ago, and the live app renders even a 1-essay grade through
 * the BATCH path (displayBatchResults). So the unification is "delete the dead
 * path," and the batch render is now the ONE render path.
 *
 * These tests pin the surviving batch render contract (createStudentRowHTML) so a
 * future refactor can't silently change the structure the live app depends on.
 * createStudentRowHTML is a pure HTML-string builder, rendered into jsdom and
 * asserted directly.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { loadModules } from '../setup/load-module.js';

/** Render an HTML string into a detached container we can query. */
function render(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('Render-path contract net', () => {
  beforeEach(() => {
    // categories.js provides window.CATEGORIES (createCategoryButtons/ColorLegend
    // read it); display-utils.js provides the builders under test.
    loadModules('public/js/categories.js', 'public/js/grading/display-utils.js');
  });

  describe('BATCH render (createStudentRowHTML) — the one live render path', () => {
    const essay = { success: true, studentName: 'Ada', essayId: 'e-1' };

    it('produces the indexed student row + highlights-tab scheme with toggleTab wiring', () => {
      const out = render(window.DisplayUtilsModule.createStudentRowHTML(essay, 0, '✓'));

      // Indexed batch containers.
      expect(out.querySelector('[id="student-row-0"]')).not.toBeNull();
      expect(out.querySelector('[id="batch-essay-0"]')).not.toBeNull();

      // Highlights tab: indexed scheme + the generic toggleTab wiring.
      expect(out.querySelector('[id="highlights-tab-0"]')).not.toBeNull();
      expect(out.querySelector('[id="highlights-tab-content-0"]')).not.toBeNull();
      expect(out.innerHTML).toContain("toggleTab('highlights-tab-0', 0)");
      // It does NOT use the single-essay bare scheme.
      expect(out.innerHTML).not.toContain("toggleHighlightsSection('highlights-content')");
    });

    it('carries the essay identity (data-essay-id) for cross-tab-safe restore', () => {
      const out = render(window.DisplayUtilsModule.createStudentRowHTML(essay, 0, '✓'));
      const row = out.querySelector('[id="student-row-0"]');
      expect(row.getAttribute('data-essay-id')).toBe('e-1');
      expect(row.getAttribute('data-student-name')).toBe('Ada');
    });
  });
});
