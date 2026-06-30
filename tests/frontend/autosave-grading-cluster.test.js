/**
 * Characterization net for auto-save.js Cluster G (grading-state + form lock),
 * BEFORE extracting it to auto-save-grading.js.
 *
 * Pins the publicly-observable behavior of the 4 grading-state primitives so the
 * extraction (which moves them + their gradingInProgress/formLocked state to a
 * new file, behind a getter/setter seam the core uses) can't silently change
 * behavior. Drives the REAL auto-save.js via eval-into-jsdom through the public
 * window.AutoSaveModule surface the live app uses.
 *
 * Public Cluster G surface on window.AutoSaveModule:
 *   markGradingStarted, markGradingFinished, isGradingInProgress, setFormLocked.
 *
 * NOTE: clearSavedSession (mapped under G) is intentionally NOT extracted — it's
 * a cross-cluster teardown orchestrator that stays in core. It is exercised by
 * its own existing paths, not here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadModules } from '../setup/load-module.js';

describe('auto-save Cluster G — grading-state + form lock characterization', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.TabStore;
    loadModules(
      'public/js/grading/auto-save-state.js',
      'public/js/grading/auto-save-grading.js',
      'public/js/grading/auto-save-ui.js',
      'public/js/grading/auto-save.js'
    );
  });
  afterEach(() => {
    delete window.TabStore;
  });

  describe('grading-in-progress flag', () => {
    it('defaults to false; markGradingStarted sets it; markGradingFinished clears it', () => {
      expect(window.AutoSaveModule.isGradingInProgress()).toBe(false);
      window.AutoSaveModule.markGradingStarted();
      expect(window.AutoSaveModule.isGradingInProgress()).toBe(true);
      window.AutoSaveModule.markGradingFinished();
      expect(window.AutoSaveModule.isGradingInProgress()).toBe(false);
    });

    it('markGradingStarted dispatches grading-started on window with the active tab id', () => {
      window.TabStore = { activeId: () => 'tab-7' };
      const seen = [];
      const handler = (e) => seen.push(e.detail);
      window.addEventListener('grading-started', handler);
      window.AutoSaveModule.markGradingStarted();
      window.removeEventListener('grading-started', handler);
      expect(seen).toHaveLength(1);
      expect(seen[0].originTabId).toBe('tab-7');
    });

    it('markGradingStarted tolerates a missing TabStore (originTabId null)', () => {
      const seen = [];
      const handler = (e) => seen.push(e.detail);
      window.addEventListener('grading-started', handler);
      window.AutoSaveModule.markGradingStarted();      // no TabStore stubbed
      window.removeEventListener('grading-started', handler);
      expect(seen).toHaveLength(1);
      expect(seen[0].originTabId).toBeNull();
    });

    it('markGradingFinished dispatches grading-finished on window', () => {
      let fired = false;
      const handler = () => { fired = true; };
      window.addEventListener('grading-finished', handler);
      window.AutoSaveModule.markGradingFinished();
      window.removeEventListener('grading-finished', handler);
      expect(fired).toBe(true);
    });
  });

  describe('setFormLocked', () => {
    /** Build a tab pane with a #gradingForm; optionally register it in a TabStore stub. */
    function makePane(tabId, { hasResults } = {}) {
      const pane = document.createElement('div');
      pane.className = 'tab-pane';
      pane.dataset.tabId = tabId;
      const form = document.createElement('form');
      form.id = 'gradingForm';
      pane.appendChild(form);
      document.body.appendChild(pane);
      return { pane, form };
    }

    it('locking a tab WITH results hides its form; unlocking restores it', () => {
      const { form } = makePane('tab-1');
      window.TabStore = {
        paneForTab: (id) => document.querySelector(`.tab-pane[data-tab-id="${id}"]`),
        get: (id) => (id === 'tab-1' ? { currentBatchData: { foo: 1 } } : null),
      };
      window.AutoSaveModule.setFormLocked(true, 'tab-1');
      expect(form.style.display).toBe('none');     // has results → hidden
      window.AutoSaveModule.setFormLocked(false, 'tab-1');
      expect(form.style.display).toBe('');         // unlocked → visible
    });

    it('locking a tab WITHOUT results keeps its form visible (blank tab stays usable)', () => {
      const { form } = makePane('tab-1');
      window.TabStore = {
        paneForTab: (id) => document.querySelector(`.tab-pane[data-tab-id="${id}"]`),
        get: () => ({ currentBatchData: null }),   // no batch data
      };
      window.AutoSaveModule.setFormLocked(true, 'tab-1');
      expect(form.style.display).toBe('');         // empty tab → form stays shown
    });

    it('no tabId → operates on ALL panes (locks each with results)', () => {
      const a = makePane('tab-1');
      const b = makePane('tab-2');
      window.TabStore = {
        get: () => ({ currentBatchData: { x: 1 } }), // both have results
      };
      window.AutoSaveModule.setFormLocked(true);    // null tabId → all panes
      expect(a.form.style.display).toBe('none');
      expect(b.form.style.display).toBe('none');
    });
  });
});
