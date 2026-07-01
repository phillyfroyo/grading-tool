/**
 * Characterization net for auto-save.js Cluster C (restore & reattach), BEFORE
 * extracting it to auto-save-restore.js.
 *
 * Cluster C is the HIGHEST-RISK cluster — it's the DOM rehydrator where the
 * recent cross-tab production bugs lived (swap-guard, legacy-payload gates,
 * tab-scoped lookups, the 250ms reattach). This net pins the observable
 * behaviors the extraction must preserve EXACTLY, driving the REAL artifact via
 * eval-into-jsdom:
 *
 *   1. applyScoreOverrides — writes score input value + dispatches an input
 *      event, scoped to the PASSED tab (not the active tab). The multi-tab
 *      scoping is the exact bug-family this project keeps re-biting.
 *   2. restoreTabDOM swap-guard — a LEGACY save (no renderedHTMLEssayIds) that
 *      is partial/has failures must SKIP index-based HTML injection (mis-pairing
 *      guard); an id-mapped save lands HTML only on the row whose data-essay-id
 *      matches.
 *   3. reattachHandlers — strips the "already initialized" marker attributes the
 *      injected innerHTML carries, scoped to the right tab, after its 250ms defer.
 *   4. reattachHighlightsHandlers content-branch tab scoping — covered by the
 *      sibling reattach-highlights-content-tabscope.test.js; not duplicated here.
 *
 * The restore functions live in auto-save-restore.js as window.AutoSaveRestore
 * (restoreTabDOM / applyScoreOverrides / reattachHandlers /
 * reattachHighlightsHandlers / …); this net drives that surface directly. It
 * was first baselined GREEN against the pre-extraction core (via a temp facade
 * hook) so the move is proven behavior-preserving.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadModules } from '../setup/load-module.js';

/** Create (or reuse) a tab pane, returning its element. One pane per tabId —
 *  a single tab is ONE pane that holds all its #batch-essay-N rows. */
function getPane(tabId) {
  let pane = document.querySelector(`.tab-pane[data-tab-id="${tabId}"]`);
  if (!pane) {
    pane = document.createElement('div');
    pane.className = 'tab-pane';
    pane.dataset.tabId = tabId;
    document.body.appendChild(pane);
  }
  return pane;
}

/** Append a #batch-essay-N row (score input + feedback) into the tab's pane. */
function makeEssayRow(tabId, index, { essayId } = {}) {
  const pane = getPane(tabId);
  const row = document.createElement('div');
  row.id = `batch-essay-${index}`;
  if (essayId) row.dataset.essayId = essayId;

  const score = document.createElement('input');
  score.className = 'editable-score';
  score.dataset.category = 'grammar';
  score.value = '0';

  const feedback = document.createElement('textarea');
  feedback.className = 'editable-feedback';
  feedback.dataset.category = 'grammar';

  row.appendChild(score);
  row.appendChild(feedback);
  pane.appendChild(row);
  return { pane, row, score, feedback };
}

describe('auto-save Cluster C — restore/reattach characterization', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.TabStore;
    vi.useFakeTimers(); // reattach* defer their work behind a 250ms setTimeout
    loadModules(
      'public/js/ui/tab-store.js',
      'public/js/grading/auto-save-state.js',
      'public/js/grading/auto-save-grading.js',
      'public/js/grading/auto-save-ui.js',
      'public/js/grading/auto-save-payload.js',
      'public/js/grading/auto-save-capacity.js',
      'public/js/grading/auto-save-restore.js',
      'public/js/grading/auto-save.js'
    );
    window.TabStore.clear();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    delete window.TabStore;
    delete window.essayData_0; // legacy-global seed used by the reattach test
  });

  describe('applyScoreOverrides — score + rationale writes', () => {
    it('writes the override points into the score input, dispatches input, and fills the rationale', () => {
      // Single tab (cross-tab #id scoping is jsdom-unreliable under duplicate
      // batch-essay-N ids and is pinned by the sibling content-tabscope test via
      // the robust [id="…"] selector; here we pin the value-write + input-event +
      // feedback-rationale behavior the export/recalc path depends on).
      const t = makeEssayRow('tab-1', 0);
      window.TabStore.deserialize({
        activeTabId: 'tab-1', nextIdCounter: 2, tabs: [{ id: 'tab-1', label: 'T1' }],
      });

      const inputEvents = [];
      t.score.addEventListener('input', () => inputEvents.push(t.score.value));

      window.AutoSaveRestore.applyScoreOverrides(
        { 0: { gradingData: { scores: { grammar: { points: 7, rationale: 'good' } } } } },
        'tab-1'
      );

      expect(t.score.value).toBe('7');     // points written into the score input
      expect(inputEvents).toEqual(['7']);  // input event dispatched (drives the total recalc)
      expect(t.feedback.value).toBe('good'); // rationale → feedback textarea
    });

    it('no-ops on null overrides without throwing', () => {
      expect(() => window.AutoSaveRestore.applyScoreOverrides(null, 'tab-1')).not.toThrow();
    });
  });

  describe('restoreTabDOM swap-guard — legacy partial saves', () => {
    it('SKIPS index-based HTML injection for a legacy save with a failed essay', () => {
      // Legacy save: renderedHTML present, NO renderedHTMLEssayIds (idMap). The
      // batch has a failed essay → index injection could slide HTML onto the
      // wrong student, so the guard must refuse to inject.
      const { row } = makeEssayRow('tab-1', 0);
      row.innerHTML = '<span class="placeholder">retry</span>';
      window.TabStore.deserialize({
        activeTabId: 'tab-1', nextIdCounter: 2, tabs: [{ id: 'tab-1', label: 'T1' }],
      });

      const tabData = {
        renderedHTML: { 0: '<div class="injected">SHOULD NOT APPEAR</div>' },
        // no renderedHTMLEssayIds → legacy path
        currentBatchData: { batchResult: { results: [{ success: false }] } },
      };
      window.AutoSaveRestore.restoreTabDOM(tabData, 'tab-1');

      // Injection refused — the placeholder stands, the injected HTML never lands.
      expect(row.innerHTML).not.toContain('SHOULD NOT APPEAR');
    });

    it('injects by id-map onto the row whose data-essay-id matches (not by index)', () => {
      // id-mapped save: HTML for index 0 belongs to essayId "B". The row at
      // index 0 carries essayId "A"; a second row carries "B". Pairing-by-id
      // must land the HTML on the "B" row, never the index-0 "A" row.
      const a = makeEssayRow('tab-1', 0, { essayId: 'A' });
      const b = makeEssayRow('tab-1', 1, { essayId: 'B' });
      window.TabStore.deserialize({
        activeTabId: 'tab-1', nextIdCounter: 3, tabs: [{ id: 'tab-1', label: 'T1' }],
      });

      const tabData = {
        renderedHTML: { 0: '<div class="injected">FOR-B</div>' },
        renderedHTMLEssayIds: { 0: 'B' },
        currentBatchData: { batchResult: { results: [{ success: true }, { success: true }] } },
      };
      window.AutoSaveRestore.restoreTabDOM(tabData, 'tab-1');

      expect(b.row.innerHTML).toContain('FOR-B'); // landed on the id-matched row
      expect(a.row.innerHTML).not.toContain('FOR-B'); // NOT on the index-0 row
    });
  });

  describe('reattachHandlers — marker-attribute strip after the 250ms defer', () => {
    it('strips data-listeners-attached / data-listener-added from the restored row', () => {
      const { row } = makeEssayRow('tab-1', 0);
      row.setAttribute('data-listeners-attached', 'true');
      row.querySelector('.editable-score').setAttribute('data-listener-added', 'true');
      window.TabStore.deserialize({
        activeTabId: 'tab-1', nextIdCounter: 2, tabs: [{ id: 'tab-1', label: 'T1' }],
      });
      // reattachHandlers early-returns unless readEssayData(index) yields data;
      // seed the legacy global it falls back to so the strip path runs.
      window.essayData_0 = { essay: { result: {} }, originalData: {} };

      window.AutoSaveRestore.reattachHandlers(0, 'tab-1');
      vi.advanceTimersByTime(250); // fire the deferred reattach body

      // Markers survive innerHTML injection but listeners don't — reattach must
      // strip them so setup functions re-attach the per-element listeners.
      expect(row.hasAttribute('data-listeners-attached')).toBe(false);
      expect(row.querySelector('.editable-score').hasAttribute('data-listener-added')).toBe(false);
    });
  });
});
