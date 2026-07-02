# Dictionary-Based Spelling — Design & Lessons

**Status:** Prototyped on branch `debug-duplicate-error-marking`, then reverted to a
clean slate (pre-dictionary) to plan a proper implementation with fresh eyes.
This document captures the *intended behavior*, the *merge policy with GPT*, the
*highlight treatment*, and — importantly — *why doing it now got complicated*, so
the work can be planned well before re-attempting.

**Written:** 2026-07-01. **Context:** summer courses running, north campus
adopting; the app works well for current users. This is a deliberate pause to
avoid patching complexity onto complexity. See also the app-wide refactor note at
the end.

---

## 1. The problem that started this

Prod logs showed warnings like `⚠️ Could not find exact match for: "..."`. While
investigating, we discovered a more important behavior:

- **A word misspelled the same way N times was only highlighted ONCE.**
  Root cause: `grader/grader-simple.js convertToSystemFormat` used
  `studentText.indexOf(errorText)` (first match only), and GPT itself only
  *reports* a repeated misspelling once. So repeats were never marked past the
  first occurrence.

We also confirmed (by dumping GPT's raw `errors` array) that GPT is **inconsistent
and single-occurrence** for spelling: it reports a repeated misspelling one time,
sometimes with surrounding context, sometimes not. This is exactly the kind of
job a deterministic dictionary does better.

---

## 2. Why a dictionary (and the division of labor)

The browser's red-squiggle spellcheck is reliable for *non-word* detection but
**cannot be read from JavaScript** (no API). So we replicate the same engine class
(Hunspell) server-side via `nspell` + `dictionary-en`.

Key truth about a dictionary: it answers exactly ONE question per word — **"is
this exact string a known word?"** It does NOT understand context, intent, or
proper nouns, and its `.suggest()` corrections are heuristic and often wrong.

**Division of labor (the core design):**

| Source | Owns | Why |
|--------|------|-----|
| **Dictionary** | Detecting non-word misspellings, EVERY occurrence, with real offsets | Deterministic, free, exhaustive — GPT's weak spot |
| **GPT** | Corrections; contextual/real-word confusions (vocabulary); grammar/mechanics/fluency; spelling of **capitalized** words | Needs meaning/context — the dictionary's blind spot |

**They run in PARALLEL and MERGE** — NOT sequentially. GPT already runs in the
same grade call, so we get its contribution for free and reconcile at a merge
step. (We explicitly rejected "dictionary first, then GPT checks its work":
sequential adds latency + prompt-injection fragility and re-couples the
deterministic part to the non-deterministic one. The correction-source benefit is
achieved at merge-time instead — see §4.)

---

## 3. The dictionary detection rules (`spellcheck.js`)

Detect misspelled words, **one entry per occurrence**, with real character offsets.
Corrections are NOT computed here.

**Skip rule — check a word UNLESS it is "Titlecase":**
- **SKIP** Titlecase (first letter uppercase + a following lowercase letter, e.g.
  `Serengeti`, `Maria`, `Nowadays`). The dictionary can't tell a real proper noun
  from a typo, so we skip the whole shape. GPT covers spelling for these.
- **CHECK** all-lowercase words (`enviorement`).
- **CHECK** ALL-CAPS words (`ENVIOREMENT`) — students write required VOCAB in caps,
  and we still want those caught. Compare case-insensitively (lowercase before the
  dictionary lookup).
- **SKIP** tokens with an apostrophe (`dont`, `john's`) — contractions/possessives
  are a *mechanics* concern, left to GPT.
- **SKIP** tokens with digits (`covid19`).

Rationale for skip-Titlecase (vs. "skip anything capitalized"): it preserves the
proper-noun protection while still checking ALL-CAPS vocab words. This resolves the
tension the user correctly identified: proper nouns must be skipped, but misspelled
all-caps vocab must be caught.

**Known trade-off:** a misspelled proper noun (`Seringeti`) or a misspelled
sentence-initial word (`Teh cat...`) won't be caught by the dictionary. GPT is the
only source for those. Acceptable.

---

## 4. The merge policy (`spelling-merge.js`)

This is the subtle part and where most of the complexity lives. Pure, deterministic,
unit-testable (no OpenAI/DB).

**Rules, in order:**

1. **The dictionary is authoritative on WHAT IS A SPELLING ERROR.** If a word is
   not in the dictionary, it is a spelling error — full stop — regardless of how
   GPT categorized it. (Example: `pounching` — GPT called it *vocabulary*
   (→ poaching), but it's a non-word, so it's SPELLING. User's explicit call:
   "pounching should be a spelling error, not vocab.")

2. **On collision (same word/span), the dictionary wins the CATEGORY (spelling) but
   ABSORBS GPT's `correction` + `explanation`.** So `pounching` renders as
   `[spelling] pounching → poaching` *with* GPT's note "poaching = illegal hunting".
   The colliding GPT error is then removed (folded in).
   - This satisfies the user's real need: "spelling corrections should come from
     GPT" — achieved at merge-time, not via a sequential pass.

3. **Match ONLY on single-word GPT errors** (error_text is exactly the word ±
   surrounding punctuation, no internal whitespace). **CRITICAL LESSON:** an earlier
   version matched if the word appeared as a *token inside* a GPT multi-word phrase.
   That was wrong — it absorbed whole-phrase corrections onto single words:
   - `de` (stray word) got correction "keeps all the species alive"
   - both `enviorement` occurrences got the same phrase correction
     "helps the animals in their natural wild environment"
   Restricting to single-word matches fixed it. Multi-word GPT phrases are DIFFERENT
   errors about a span and must pass through untouched.

4. **GPT keeps spelling ownership ONLY for Titlecase words** (the dictionary's blind
   spot). All other GPT spelling errors are superseded by the dictionary and dropped.

5. **Dictionary-only flags** (no colliding GPT error): correction comes from
   `.suggest()` fallback, or none (acceptable — a bare `de` may have no good
   suggestion).

**Correction priority:** colliding GPT correction → `.suggest()` fallback → none.

**Do NOT strip trailing punctuation from corrections.** We tried this to "clean up"
`environments.` and it was WRONG — when the misspelling is the last word of a
sentence, both the essay text and GPT's correction legitimately include the period.

---

## 5. Highlight treatment (overlap & multi-category)

When a dictionary spelling flag and a GPT error refer to the same region, the
formatter (`grader/formatter.js resolveOverlapsFixed`) reconciles them. Two cases:

- **Case A — EXACT same span** (e.g. `pounching` == GPT's single-word error):
  collapse to ONE spelling highlight, absorbing GPT's correction/explanation.
  (Handled in the merge layer, §4.)

- **Case B — PARTIAL overlap / different span** (e.g. `de` inside the grammar
  phrase `keeps with live all de species`): keep the LONGER GPT highlight (its
  span + its phrase correction), but **tag it multi-category** (e.g.
  `grammar,spelling`) so the region shows it has 2+ errors. Drop the standalone
  short spelling highlight. The correction shown is GPT's phrase correction only.

**Tally:** `countErrorsByCategory` (`grader/scoring.js`) must count EVERY
comma-separated category, not just the first — so a `grammar,spelling` highlight
increments BOTH tallies. (User: "count spelling in tally.") This also fixes
existing `grammar,mechanics` merges that previously under-counted.

**Visual for multi-category:** mirror the manual-edit path
(`public/js/essay/highlighting.js updateHighlightVisualStyling`): a
`grammar,spelling` highlight renders in the primary (grammar) color PLUS a dashed
underline + inner box-shadow in the SECONDARY category's color. This makes
server-generated multi-category highlights look identical to manually-created ones.

---

## 6. WHERE IT GOT STUCK (the unfinished part)

The visual multi-category indicator works. But **two things did NOT work**, and
they are the reason for the pause:

- **Edit modal** shows only ONE category selected (grammar), not both.
- **Error/correction list** shows only "Grammar", not "Grammar & Spelling".

Investigation found that **every reader of `data-category` in the front-end is
correct** — they all comma-split it (`highlighting.js:347/432`,
`display-utils.js:386`). The modal button-selection logic (`highlighting.js:1029`)
and list formatting (`display-utils.js:598-610`) both handle multi-category.

So the bug must be that the **LIVE DOM `data-category` value is collapsed to
"grammar"** by the time these read it — i.e. the multi-category value is lost
somewhere between server HTML injection and the client read. This was NOT
confirmed. Prime suspects (unverified):
- `highlighting.js:1642` (`ensureHighlightClickHandlers`) re-deriving
  `data-category` from the CSS class (which is first-category-only) — guarded by
  `if (!dataset.category)`, so should only fire if the attribute is empty.
- A save/restore round-trip through `innerHTML` that drops or re-derives it.
- Some highlight re-init that rebuilds marks from a single-category model.

**Next step when resuming:** inspect the actual `<mark>` `data-category` in the
live DOM at click time (DevTools) to confirm server-vs-client collapse, THEN fix
at the real source.

---

## 7. THE ROOT ARCHITECTURAL PROBLEM (why this keeps happening)

Every bug in this effort is the SAME failure: **multiple, competing
representations of "a highlight/error" that re-derive from each other lossily.**

The representations we counted:
1. GPT's raw `errors[]`
2. `inline_issues[]` (with offsets)
3. Server-rendered `<mark>` HTML string
4. Returned `errors`/`segments` fields (found to be PRE-overlap-resolution —
   stale/dormant; nothing consumes them, but they're a trap)
5. The live DOM marks the front-end re-parses
6. Front-end re-derivations (class→category, model rebuilds, save/restore)

Multi-category is the first feature that requires the "2 categories" fact to
survive EVERY hop — and it doesn't. The color survived (baked into HTML string);
the modal/list broke (they read a re-derived model).

**The proposed fix (future refactor):** a single canonical highlight object —
`{ span, categories[], correction, explanation, ... }` with **categories as a
first-class array**, never a comma-string that gets split-and-collapsed. The
`<mark>` and the interactive model both PROJECT from that one object; the
front-end never re-parses HTML back into a model. This collapses ~4 representations
into 1 and kills the entire bug family.

This is the same insight as the "dictionary-first vs merge" debate: put the truth
in ONE place and project from it; don't re-derive.

---

## 8. Files touched by the prototype (for reference when re-attempting)

New:
- `grader/spellcheck.js` — dictionary detection (skip rules, per-occurrence, offsets)
- `grader/spelling-merge.js` — merge policy (dictionary-wins-category + absorb notes)

Modified:
- `grader/grader-simple.js` — wire dictionary+merge into `detectErrors`;
  `convertToSystemFormat` honors explicit offsets (so per-occurrence survives)
- `grader/error-detection-simple.js` — static prompt nudge (GPT focuses spelling on
  capitalized words; dictionary handles the rest)
- `grader/formatter.js` — Case B overlap tagging + multi-category visual indicator
- `grader/scoring.js` — `countErrorsByCategory` counts ALL comma-categories

Deps added: `nspell`, `dictionary-en`.

`dictionary-en@4` default export is the `{ aff, dic }` object directly:
`const dict = await dictionaryEn; nspell(dict)`.

---

## 9. Broader note: file bloat / app-wide refactor

We've let several files get large (`grader/formatter.js`,
`public/js/essay/highlighting.js`, `grader/grader-simple.js`), which makes even
small improvements stressful and error-prone. Plan a staged refactor over weeks
(not a big-bang), likely starting with the highlight single-source-of-truth (§7),
then the formatter's multiple render/return paths. The dictionary-spelling feature
should be re-attempted AFTER (or as part of) that cleaner foundation, not bolted
onto the current pipeline.
