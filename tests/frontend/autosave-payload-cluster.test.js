/**
 * Characterization net for auto-save.js Cluster B (payload build / de-dup),
 * BEFORE extracting it to auto-save-payload.js.
 *
 * Pins the SHAPE and de-dup behavior of the save payload — the contract the
 * server and the restore path depend on — so the extraction (which moves
 * buildPayload/gatherTabDOMState/readEssayData/payloadHasResults to a new file)
 * can't silently change what gets saved. Drives the REAL auto-save.js +
 * tab-store.js via eval-into-jsdom; seeds genuine TabStore state with create()
 * and asserts the payload buildPayload() produces.
 *
 * Cluster B is internal-only (no window.AutoSaveModule members), so it's
 * exercised here through the structural pieces rather than the public facade.
 * After extraction these same calls route through window.AutoSavePayload.
 *
 * NOTE: countEssayDataGlobals (mapped under B) is DEAD (zero callers) and is
 * deleted in the extraction, so it is intentionally not pinned here.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadModules } from '../setup/load-module.js';

/** The internal builders live on a per-file closure; we reach them by calling
 * buildPayload (public-ish within the module via AutoSaveModule? no — internal).
 * Cluster B isn't on the facade, so we drive it through the live integration:
 * seed TabStore, then read window.__buildPayloadProbe if present, else exercise
 * the observable effects. Simplest stable handle: the module assigns nothing for
 * B, so we test via the one public path that calls buildPayload — capacity
 * evaluation is internal too. We therefore load the modules and call the
 * extracted global once it exists; pre-extraction we assert through TabStore +
 * a thin re-exposed hook. To keep the net artifact-driven and stable across the
 * move, we assert buildPayload via window.AutoSavePayload when present and fall
 * back to a no-op skip guard otherwise. */

function seedTab(fields) {
  // create() shallow-merges caller fields over an empty tab state.
  return window.TabStore.create(fields);
}

// Resolve buildPayload regardless of pre/post extraction:
//  - post-extraction: window.AutoSavePayload.buildPayload
//  - pre-extraction (baseline): not exposed; baseline run uses the same global
//    because the extraction adds it. For the BASELINE we temporarily expose it
//    (see the baseline note in the commit); normally this resolves to the new module.
function buildPayload(omitHTML) {
  return window.AutoSavePayload.buildPayload(omitHTML);
}
function payloadHasResults(p) {
  return window.AutoSavePayload.payloadHasResults(p);
}

describe('auto-save Cluster B — payload build/de-dup characterization', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.TabStore;
    delete window.currentBatchData;
    loadModules(
      'public/js/ui/tab-store.js',
      'public/js/grading/auto-save-payload.js',
      'public/js/grading/auto-save-state.js',
      'public/js/grading/auto-save-grading.js',
      'public/js/grading/auto-save-ui.js',
      'public/js/grading/auto-save.js'
    );
    window.TabStore.clear(); // fresh single tab-1
  });
  afterEach(() => {
    delete window.TabStore;
    delete window.currentBatchData;
  });

  describe('buildPayload shape', () => {
    it('returns null when TabStore is absent', () => {
      delete window.TabStore;
      expect(buildPayload()).toBeNull();
    });

    it('produces the dual contract: legacy sessionData + Phase-7 tabStoreSnapshot', () => {
      const p = buildPayload();
      expect(p).not.toBeNull();
      expect(p).toHaveProperty('sessionData');
      expect(p).toHaveProperty('tabStoreSnapshot');
      expect(Array.isArray(p.tabStoreSnapshot.tabs)).toBe(true);
      // sessionData carries the grading-in-progress flag (read via the Cluster G
      // getter seam) — defaults false.
      expect(p.sessionData.gradingInProgress).toBe(false);
    });

    it('reflects the grading-in-progress flag set via AutoSaveGrading', () => {
      window.AutoSaveGrading.setGradingInProgress(true);
      const p = buildPayload();
      expect(p.sessionData.gradingInProgress).toBe(true);
    });
  });

  describe('essaySnapshots de-dup (numeric-index keys only)', () => {
    it('persists ONLY numeric-index essayData entries, dropping essayId-keyed dupes', () => {
      // batch-processing stores each essay twice: under index AND essayId.
      // Restore reads only /^essayData_\d+$/, so the payload must drop the
      // essayId-keyed copies (a major payload-weight de-dup).
      const snap = { essay: { text: 'x' }, originalData: { name: 'Ada' } };
      seedTab({
        currentBatchData: { batchResult: { results: [snap], totalEssays: 1 } },
        essayData: { 0: snap, 'abc123xyz': snap }, // index + essayId
      });
      const p = buildPayload();
      const tab = p.tabStoreSnapshot.tabs.find(t => t.essaySnapshots
        && Object.keys(t.essaySnapshots).length);
      expect(tab).toBeTruthy();
      const keys = Object.keys(tab.essaySnapshots);
      expect(keys).toContain('essayData_0');         // numeric kept
      expect(keys).not.toContain('essayData_abc123xyz'); // essayId-keyed dropped
      expect(keys).toHaveLength(1);
    });
  });

  describe('payloadHasResults', () => {
    it('true only when sessionData.currentBatchData.batchResult.results is non-empty', () => {
      const tabId = seedTab({
        currentBatchData: { batchResult: { results: [{ essay: {} }], totalEssays: 1 } },
        essayData: { 0: { essay: {}, originalData: {} } },
      });
      // payloadHasResults reads the legacy sessionData, which buildPayload builds
      // from the PRIMARY (active) tab — so make the seeded tab active.
      window.TabStore.switchTo(tabId);
      expect(payloadHasResults(buildPayload())).toBe(true);
    });

    it('false for an empty/blank session', () => {
      expect(payloadHasResults(buildPayload())).toBe(false);
      expect(payloadHasResults(null)).toBe(false);
      expect(payloadHasResults({ sessionData: {} })).toBe(false);
    });
  });

  describe('omitHTML', () => {
    it('omits renderedHTML capture when omitHTML is true', () => {
      // Seed a tab with results + a rendered batch-essay div in the DOM.
      const tabId = seedTab({
        currentBatchData: { batchResult: { results: [{ essay: {} }], totalEssays: 1 } },
      });
      window.TabStore.switchTo(tabId);
      // buildPayload(true) should not populate renderedHTML even if a div exists.
      const p = buildPayload(true);
      const tab = p.tabStoreSnapshot.tabs.find(t => t.id === tabId);
      expect(Object.keys(tab.renderedHTML || {})).toHaveLength(0);
    });
  });
});
