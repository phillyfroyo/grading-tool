/**
 * Characterization net for auto-save.js Cluster D (capacity / budget), BEFORE
 * extracting it to auto-save-capacity.js.
 *
 * Pins the observable capacity behavior — the pill element's class/text bands,
 * the percent math, the at-ceiling edit-block flip, and the warn/full banner +
 * resetFullDismissed wiring evaluatePayloadBudget drives — so the extraction
 * (which moves these functions + their state PAYLOAD_CEILING_BYTES /
 * payloadOverBudget / lastPayloadBytes to a new file) can't silently change
 * behavior. Drives the REAL artifact via eval-into-jsdom.
 *
 * Cluster D's public members are getCapacityPercent + isPayloadOverBudget; the
 * driver evaluatePayloadBudget / chip updateCapacityChip are internal, exercised
 * via window.AutoSaveCapacity (the extracted global; pre-extraction a temp hook
 * exposes the same surface so this net baselines against current behavior).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadModules } from '../setup/load-module.js';

const CEILING = 3_800_000; // PAYLOAD_CEILING_BYTES — keep in sync with source

/** Build the capacity pill markup the chip updater reads. */
function installChip() {
  const chip = document.createElement('div');
  chip.id = 'autosaveCapacityChip';
  chip.hidden = true;
  const text = document.createElement('span');
  text.id = 'autosaveCapacityChipText';
  chip.appendChild(text);
  document.body.appendChild(chip);
  return { chip, text };
}
/** A JSON body string of approximately `bytes` UTF-8 length. */
function bodyOfBytes(bytes) {
  return JSON.stringify({ pad: 'x'.repeat(Math.max(0, bytes - 12)) });
}

describe('auto-save Cluster D — capacity/budget characterization', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers(); // updateCapacityBanner arms no timers, but toasts might
    loadModules(
      'public/js/grading/auto-save-capacity.js',
      'public/js/grading/auto-save-ui.js',
      'public/js/grading/auto-save-payload.js',
      'public/js/grading/auto-save-state.js',
      'public/js/grading/auto-save-grading.js',
      'public/js/grading/auto-save.js'
    );
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('getCapacityPercent + evaluatePayloadBudget', () => {
    it('reports the percent of the ceiling the last measured payload used', () => {
      installChip();
      window.AutoSaveCapacity.evaluatePayloadBudget(bodyOfBytes(Math.round(CEILING / 2)));
      // ~50% (allow rounding slack from the JSON wrapper bytes)
      const pct = window.AutoSaveCapacity.getCapacityPercent();
      expect(pct).toBeGreaterThanOrEqual(49);
      expect(pct).toBeLessThanOrEqual(51);
    });
  });

  describe('isPayloadOverBudget — the edit-block flip', () => {
    it('false under the ceiling, true at/over it, and back to false when it drops', () => {
      installChip();
      window.AutoSaveCapacity.evaluatePayloadBudget(bodyOfBytes(Math.round(CEILING * 0.5)));
      expect(window.AutoSaveCapacity.isPayloadOverBudget()).toBe(false);

      window.AutoSaveCapacity.evaluatePayloadBudget(bodyOfBytes(CEILING + 5000));
      expect(window.AutoSaveCapacity.isPayloadOverBudget()).toBe(true);  // at/over → blocked

      window.AutoSaveCapacity.evaluatePayloadBudget(bodyOfBytes(Math.round(CEILING * 0.4)));
      expect(window.AutoSaveCapacity.isPayloadOverBudget()).toBe(false); // dropped → re-enabled
    });
  });

  describe('updateCapacityChip — pill bands + reveal', () => {
    it('reveals the hidden pill and sets the right color band + text per percent', () => {
      const { chip, text } = installChip();
      expect(chip.hidden).toBe(true);

      window.AutoSaveCapacity.updateCapacityChip(50);
      expect(chip.hidden).toBe(false);                // revealed on first measure
      expect(chip.classList.contains('is-ok')).toBe(true);
      expect(text.textContent).toBe('Autosave 50%');

      window.AutoSaveCapacity.updateCapacityChip(80);
      expect(chip.classList.contains('is-warn')).toBe(true);

      window.AutoSaveCapacity.updateCapacityChip(95);
      expect(chip.classList.contains('is-full')).toBe(true);
      expect(text.textContent).toBe('Autosave 95% — clear a tab'); // 90%+ hint

      window.AutoSaveCapacity.updateCapacityChip(110);
      expect(chip.classList.contains('is-over')).toBe(true);       // past ceiling band
      expect(text.textContent).toBe('Autosave 110% — clear a tab');
    });

    it('no-ops safely when the chip element is absent', () => {
      // No chip in the DOM — must not throw (it is cosmetic, never breaks saving).
      expect(() => window.AutoSaveCapacity.updateCapacityChip(50)).not.toThrow();
    });
  });
});
