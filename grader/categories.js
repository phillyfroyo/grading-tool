/**
 * Backend (ESM) accessor for the canonical correction-guide categories.
 *
 * The data lives in shared/categories.json — the SINGLE SOURCE OF TRUTH shared
 * with the browser (public/js/categories.js). This module wraps it with the
 * same helper API the frontend uses, plus `correctionGuideColors`, the legacy
 * map shape the formatter renders from.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  readFileSync(join(__dirname, '..', 'shared', 'categories.json'), 'utf8')
);

export const CATEGORY_LIST = data.categories;
export const CATEGORY_ALIASES = data.aliases || {};

const CATEGORY_BY_ID = CATEGORY_LIST.reduce((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {});
export { CATEGORY_BY_ID };

/** Resolve any id/alias to its canonical category object (or null). */
export function getCategory(idOrAlias) {
  if (!idOrAlias) return null;
  const key = String(idOrAlias).trim().toLowerCase();
  return CATEGORY_BY_ID[key] || CATEGORY_BY_ID[CATEGORY_ALIASES[key]] || null;
}

/** Full student-facing display name for a category id/alias. */
export function getCategoryName(idOrAlias) {
  const cat = getCategory(idOrAlias);
  if (cat) return cat.name;
  const s = String(idOrAlias || '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/** Compact editing-UI label for a category id/alias. */
export function getCategoryShortName(idOrAlias) {
  const cat = getCategory(idOrAlias);
  if (cat) return cat.shortName || cat.name;
  return getCategoryName(idOrAlias);
}

/** Effective rendering colors for a category. */
export function getCategoryStyle(idOrAlias) {
  const cat = getCategory(idOrAlias);
  if (!cat) return { background: 'transparent', color: '#000000', strikethrough: false };
  if (cat.style === 'fill') {
    return { background: cat.color, color: '#000000', strikethrough: !!cat.strikethrough };
  }
  return { background: 'transparent', color: cat.color, strikethrough: !!cat.strikethrough };
}

/** Categories GPT/automatic grading may emit (excludes manualOnly). */
export function getAutoCategories() {
  return CATEGORY_LIST.filter((c) => !c.manualOnly);
}

/**
 * Legacy map shape consumed by formatter.js rendering:
 *   { color, backgroundColor, name, strikethrough }
 * Includes alias keys so old GPT output / saved data still resolves.
 */
export const correctionGuideColors = (() => {
  const map = {};
  const put = (key, cat) => {
    const s = getCategoryStyle(cat.id);
    map[key] = {
      color: s.color,
      backgroundColor: s.background,
      name: cat.name,
      ...(cat.strikethrough ? { strikethrough: true, textDecoration: 'line-through' } : {}),
    };
  };
  for (const cat of CATEGORY_LIST) put(cat.id, cat);
  for (const [alias, target] of Object.entries(CATEGORY_ALIASES)) {
    const cat = CATEGORY_BY_ID[target];
    if (cat) put(alias, cat);
  }
  return map;
})();
