/**
 * Characterization net for auto-save.js Cluster E (toasts/banners UI), BEFORE
 * extracting it to auto-save-ui.js (ENGINEERING-NOTES refactor plan, Phase 3).
 *
 * Pins the publicly-observable behavior of the banner/toast system so the
 * extraction (which moves these functions to a new file + introduces a
 * capacityFullDismissed setter seam) can't silently change behavior. Drives the
 * REAL auto-save.js via eval-into-jsdom; asserts the DOM it produces.
 *
 * Public Cluster E surface on window.AutoSaveModule: showToast, showClearButton.
 * (updateSaveStatus / updateCapacityBanner are internal — exercised indirectly
 * where possible; their DOM contracts are pinned via showToast's shared stack
 * structure + the capacity banner's observable element.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadModules } from '../setup/load-module.js';

function stack() { return document.getElementById('auto-save-toast-stack'); }
function toasts() { return Array.from(document.querySelectorAll('.auto-save-toast')); }

describe('auto-save Cluster E — toast/banner UI characterization', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();          // toasts arm setTimeout dismiss timers
    loadModules('public/js/grading/auto-save.js');
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('showToast', () => {
    it('creates the fixed top-left stack and appends a success toast with a ✓ suffix', () => {
      window.AutoSaveModule.showToast('Saved', 'ok');
      const s = stack();
      expect(s).not.toBeNull();
      expect(s.style.position).toBe('fixed');
      const t = toasts();
      expect(t).toHaveLength(1);
      expect(t[0].textContent).toBe('Saved ✓');
      // green success → fit-to-text (not fixed width)
      expect(t[0].style.width).toBe('fit-content');
    });

    it('warn → ⚠ suffix + fixed 420px width; error → no suffix + fixed width', () => {
      window.AutoSaveModule.showToast('Careful', 'warn');
      window.AutoSaveModule.showToast('Broke', 'error');
      const byText = Object.fromEntries(toasts().map(t => [t.dataset.toastText, t]));
      expect(byText['Careful ⚠']).toBeTruthy();
      expect(byText['Careful ⚠'].style.width).toBe('420px');
      expect(byText['Broke']).toBeTruthy();          // error: no suffix
      expect(byText['Broke'].style.width).toBe('420px');
    });

    it('de-dupes identical toast text (no second copy)', () => {
      window.AutoSaveModule.showToast('Same', 'ok');
      window.AutoSaveModule.showToast('Same', 'ok');
      expect(toasts().filter(t => t.dataset.toastText === 'Same ✓')).toHaveLength(1);
    });

    it('auto-dismisses a success toast after 5s; a warn toast persists', () => {
      window.AutoSaveModule.showToast('Bye', 'ok');
      window.AutoSaveModule.showToast('Stay', 'warn');
      vi.advanceTimersByTime(5000);     // success dismiss timer fires
      vi.advanceTimersByTime(300);      // fade-out removal
      const texts = toasts().map(t => t.dataset.toastText);
      expect(texts).not.toContain('Bye ✓');   // success gone
      expect(texts).toContain('Stay ⚠');       // warn remains (no timer)
    });

    it('newest toast goes on top of the stack', () => {
      window.AutoSaveModule.showToast('First', 'ok');
      window.AutoSaveModule.showToast('Second', 'ok');
      expect(stack().firstElementChild.dataset.toastText).toBe('Second ✓');
    });
  });

  describe('showClearButton', () => {
    it('shows a green "…✓" success toast (the grading-complete confirmation)', () => {
      window.AutoSaveModule.showClearButton('Grading complete');
      const t = toasts();
      expect(t).toHaveLength(1);
      expect(t[0].textContent).toBe('Grading complete ✓');
      expect(t[0].style.width).toBe('fit-content'); // success → fit-to-text
    });
  });
});
