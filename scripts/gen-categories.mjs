#!/usr/bin/env node
/**
 * Generates public/js/categories.js (the browser loader) from the canonical
 * shared/categories.json. Run after editing categories.json:
 *
 *   npm run gen:categories
 *
 * The browser file is a classic <script> (no imports/fetch), so it embeds the
 * category data inline. This generator keeps that embedded copy in lockstep
 * with the JSON — categories.json remains the single source of truth.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const jsonPath = join(root, 'shared', 'categories.json');
const outPath = join(root, 'public', 'js', 'categories.js');

const raw = readFileSync(jsonPath, 'utf8');
const data = JSON.parse(raw);
const embedded = JSON.stringify(
  { categories: data.categories, aliases: data.aliases || {} },
  null,
  2
);

const out = `/**
 * Correction-guide categories — browser accessor (SINGLE SOURCE OF TRUTH).
 *
 * !!! GENERATED FILE — do not edit by hand. !!!
 * Edit shared/categories.json, then run: npm run gen:categories
 *
 * Loaded as a classic <script> BEFORE every consumer; registers
 * window.CATEGORIES with helpers used by the color-coded essay, the top/bottom
 * highlight key, the manual edit modal, and the exported PDF.
 *
 * style 'fill' = colored background + black text; 'text' = colored text,
 * transparent background. manualOnly true = GPT never emits it; a human applies
 * it manually (like the legacy 'delete' marker). The id is the persisted
 * data-category key — kept stable across renames so old essays keep rendering.
 */
(function (root) {
  'use strict';

  var DATA = ${embedded};

  var CATEGORY_LIST = DATA.categories;
  var CATEGORY_ALIASES = DATA.aliases || {};

  var CATEGORY_BY_ID = CATEGORY_LIST.reduce(function (acc, c) {
    acc[c.id] = c;
    return acc;
  }, {});

  function getCategory(idOrAlias) {
    if (!idOrAlias) return null;
    var key = String(idOrAlias).trim().toLowerCase();
    return CATEGORY_BY_ID[key] || CATEGORY_BY_ID[CATEGORY_ALIASES[key]] || null;
  }

  function getCategoryName(idOrAlias) {
    var cat = getCategory(idOrAlias);
    if (cat) return cat.name;
    var s = String(idOrAlias || '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  function getCategoryStyle(idOrAlias) {
    var cat = getCategory(idOrAlias);
    if (!cat) return { background: 'transparent', color: '#000000', strikethrough: false };
    if (cat.style === 'fill') {
      return { background: cat.color, color: '#000000', strikethrough: !!cat.strikethrough };
    }
    return { background: 'transparent', color: cat.color, strikethrough: !!cat.strikethrough };
  }

  function getManualCategories() {
    return CATEGORY_LIST.slice();
  }

  function getAutoCategories() {
    return CATEGORY_LIST.filter(function (c) { return !c.manualOnly; });
  }

  var API = {
    CATEGORY_LIST: CATEGORY_LIST,
    CATEGORY_BY_ID: CATEGORY_BY_ID,
    CATEGORY_ALIASES: CATEGORY_ALIASES,
    getCategory: getCategory,
    getCategoryName: getCategoryName,
    getCategoryStyle: getCategoryStyle,
    getManualCategories: getManualCategories,
    getAutoCategories: getAutoCategories
  };

  if (root) root.CATEGORIES = API;
})(typeof window !== 'undefined' ? window : null);
`;

writeFileSync(outPath, out);
console.log('Wrote ' + outPath + ' from ' + jsonPath);

// ── Also generate public/css/categories.css ───────────────────────────────
// Screen + print stylesheet for highlight categories, derived from the same
// JSON. Uses !important so it reliably overrides any stale inline styles on
// restored/legacy essays. Covers the color-coded essay marks, the highlight
// key swatches (.legend-<id>), and the error-list accents (.highlight-entry).
function styleOf(cat) {
  if (cat.style === 'fill') {
    return { background: cat.color, color: '#000000', strikethrough: !!cat.strikethrough };
  }
  return { background: 'transparent', color: cat.color, strikethrough: !!cat.strikethrough };
}

const cssRules = data.categories.map((cat) => {
  const s = styleOf(cat);
  const isFill = s.background !== 'transparent';
  const strike = s.strikethrough ? '\n    text-decoration: line-through !important;\n    font-weight: bold !important;' : '';

  const markBody = isFill
    ? `    background: ${s.background} !important;
    color: #000000 !important;
    padding: 2px 0 !important;
    border-radius: 2px !important;${strike}`
    : `    background: transparent !important;
    color: ${s.color} !important;
    font-weight: bold !important;${strike}`;

  const legendBody = isFill
    ? `background-color: ${s.background} !important; color: #000000 !important; padding: 2px 6px !important; border-radius: 3px !important;${s.strikethrough ? ' text-decoration: line-through !important;' : ''}`
    : `color: ${s.color} !important; background: transparent !important;${s.strikethrough ? ' text-decoration: line-through !important;' : ''}`;

  return `mark[data-category="${cat.id}"],
mark[data-type="${cat.id}"] {
${markBody}
}
.legend-${cat.id} { ${legendBody} }
.highlight-entry.${cat.id}-error { border-left-color: ${cat.color} !important; }`;
}).join('\n\n');

const cssOut = `/* ===================================================================
   Correction-guide category colors — GENERATED, do not edit by hand.
   Edit shared/categories.json, then run: npm run gen:categories
   Single source of truth shared with public/js/categories.js.
   =================================================================== */

${cssRules}
`;

const cssPath = join(root, 'public', 'css', 'categories.css');
writeFileSync(cssPath, cssOut);
console.log('Wrote ' + cssPath + ' from ' + jsonPath);
