/**
 * load-module — eval a browser IIFE / window.*Module source file into the
 * current jsdom `window`, exactly the way a <script> tag would.
 *
 * WHY eval-into-jsdom (not `import`): the front-end grading code (auto-save.js,
 * display-utils.js, tab-store.js, …) is browser code that assigns to globals
 * (`window.DisplayUtilsModule = …`) and has NO ES `export`s. vitest's `import`
 * can't reach those functions. Reading the file and `window.eval`-ing it runs
 * the byte-identical artifact the browser runs and populates the same globals —
 * so tests exercise the REAL code, with zero production-file changes. That is
 * the whole point of "harness first": pin current behavior without editing the
 * files we're about to refactor.
 *
 * Load order matters: a file that reads `window.TabStore` at call time is fine
 * as long as TabStore is loaded (or stubbed) before the function under test
 * RUNS — not before it's defined. Most of these files only touch their deps
 * inside function bodies, so define-time order is forgiving; call-time presence
 * is what counts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

/**
 * Read a project-relative JS file and eval it into the global jsdom window.
 * @param {string} relPath e.g. 'public/js/grading/display-utils.js'
 */
export function loadModule(relPath) {
  const abs = path.join(repoRoot, relPath);
  const code = fs.readFileSync(abs, 'utf8');
  // Eval in the global scope so top-level `function foo(){}` / `window.x = …`
  // land on the jsdom window the tests see. `globalThis.eval` (indirect eval)
  // guarantees global-scope evaluation rather than this function's scope.
  (0, eval)(code);
}

/** Convenience: load several modules in order. */
export function loadModules(...relPaths) {
  relPaths.forEach(loadModule);
}
