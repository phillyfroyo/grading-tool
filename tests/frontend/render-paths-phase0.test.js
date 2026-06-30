/**
 * Phase 0 — characterization net for the render-path unification (DESIGN-unify-
 * render-paths.md). Pins the CURRENT structural output of BOTH render builders
 * so the Phase-1 reroute (manual grading: displayResults → displayBatchResults)
 * can't silently change what gets rendered.
 *
 * Both builders are pure HTML-string functions (no fetch/await/DOM side effects),
 * so we render their output into jsdom and assert the structural contract each
 * side of the reroute must honor:
 *   - SINGLE-ESSAY (createSingleEssayHTML): the manual/single mode output Phase 1
 *     replaces. Uses the bare `highlights-content` id scheme + toggleHighlightsSection.
 *   - BATCH (createStudentRowHTML): what Phase 1 reroutes the manual essay INTO.
 *     Uses the indexed `highlights-tab-N` scheme + toggleTab.
 *
 * These are CHARACTERIZATION tests (pin current behavior), not assertions that the
 * two schemes match — they intentionally differ today; that difference is what the
 * unification removes. After Phase 1, the single-essay test becomes the spec for
 * "deleted" (Phase 2) and the batch test stays as the surviving contract.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { loadModules } from '../setup/load-module.js';

/** Render an HTML string into a detached container we can query. */
function render(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('Phase 0 — render-path characterization net', () => {
  beforeEach(() => {
    // categories.js provides window.CATEGORIES (createCategoryButtons/ColorLegend
    // read it); display-utils.js provides the builders under test.
    loadModules('public/js/categories.js', 'public/js/grading/display-utils.js');
  });

  describe('SINGLE-ESSAY render (createSingleEssayHTML) — current manual/single output', () => {
    const formatted = { feedbackSummary: '<div class="fb">summary</div>', formattedText: '<p>essay <mark data-category="grammar">x</mark></p>' };

    it('produces the essay content container + the bare highlights-content dropdown scheme', () => {
      const out = render(window.DisplayUtilsModule.createSingleEssayHTML('Ada', formatted));

      // Essay content area (no data-essay-index — single-essay marker).
      const essay = out.querySelector('.formatted-essay-content');
      expect(essay).not.toBeNull();
      expect(essay.hasAttribute('data-essay-index')).toBe(false);
      expect(out.innerHTML).toContain('summary');           // feedback summary injected
      expect(essay.querySelector('mark[data-category="grammar"]')).not.toBeNull(); // marks present

      // Highlights dropdown: the bare (no-index) scheme + toggleHighlightsSection wiring.
      expect(out.querySelector('[id="highlights-content"]')).not.toBeNull();
      expect(out.innerHTML).toContain("toggleHighlightsSection('highlights-content')");
      // It does NOT use the batch toggleTab / highlights-tab scheme.
      expect(out.innerHTML).not.toContain('toggleTab(');
      expect(out.querySelector('[id^="highlights-tab"]')).toBeNull();
    });

    it('includes the student name and the save-essay action', () => {
      const out = render(window.DisplayUtilsModule.createSingleEssayHTML('Ada', formatted));
      expect(out.innerHTML).toContain('Grading Results for Ada');
      expect(out.querySelector('[data-action="export-pdf"]')).not.toBeNull();
    });
  });

  describe('BATCH render (createStudentRowHTML) — the target Phase 1 reroutes into', () => {
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
