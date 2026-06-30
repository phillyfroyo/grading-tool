/**
 * Vitest global setup (jsdom env). Referenced by vitest.config.js → setupFiles.
 *
 * Keeps each test isolated: the front-end code under test mutates the shared
 * jsdom `document` and `localStorage` (and assigns `window.*Module` globals via
 * eval). We reset the DOM and storage before every test. Globals assigned by a
 * `loadModule()` call inside a test are re-assigned by the next test's own
 * load, so they don't need explicit teardown — but the DOM/localStorage do.
 */
import { afterEach, beforeEach } from 'vitest';

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  try { localStorage.clear(); } catch { /* jsdom always provides it */ }
});

afterEach(() => {
  document.body.innerHTML = '';
  try { localStorage.clear(); } catch { /* noop */ }
});
