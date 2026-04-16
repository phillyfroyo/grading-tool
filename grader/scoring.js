// grader/scoring.js
// Deterministic scoring helpers for the grading pipeline.
//
// Rationale: GPT was consistently miscounting errors and mis-mapping counts
// to rubric bands, even when the DETECTED ERRORS list was right in the
// prompt. Counts are deterministic; we compute them in code and pass GPT
// the exact band number for each countable category.
//
// Categories covered:
//   - Grammar    (error count + class-structure count when available)
//   - Vocabulary (class-vocab match count when class list is present)
//   - Spelling   (error count)
//   - Mechanics  (error count)
//   - Layout     (length deviation band + transition word band)
//
// Categories NOT covered (fully subjective, GPT reads the essay):
//   - Fluency
//   - Content
//   - Vocabulary WITHOUT class list
//   - Layout structure judgment (GPT adds this to the averaged bands)

/**
 * Given an array of inline error issues from detection, return a map of
 * per-category counts. Compound categories like "grammar,mechanics" count
 * only toward the FIRST listed category — the detection prompt puts the
 * "primary" category first, and counting compounds toward both would
 * double-penalize one mistake.
 *
 * @param {Array<{category?: string, type?: string}>} inlineIssues
 * @returns {Object<string, number>} e.g. { grammar: 2, mechanics: 3, spelling: 1 }
 */
function countErrorsByCategory(inlineIssues) {
    const counts = {};
    if (!Array.isArray(inlineIssues)) return counts;
    for (const issue of inlineIssues) {
        const raw = issue.category || issue.type || 'unknown';
        const primary = String(raw).split(',')[0].trim();
        if (!primary) continue;
        counts[primary] = (counts[primary] || 0) + 1;
    }
    return counts;
}

/**
 * Map an error count to a band number (1 = top/best, 5 = bottom/worst)
 * using ascending thresholds.
 *
 * Example for Grammar errors: thresholds [3, 5, 9, 15]
 *   count <= 3  → band 1
 *   count <= 5  → band 2
 *   count <= 9  → band 3
 *   count <= 15 → band 4
 *   count > 15  → band 5
 *
 * @param {number} count
 * @param {number[]} thresholds - 4 ascending values
 * @returns {number} 1-5
 */
function bandFromCountAscending(count, thresholds) {
    for (let i = 0; i < thresholds.length; i++) {
        if (count <= thresholds[i]) return i + 1;
    }
    return 5;
}

/**
 * Map a match count (higher = better) to a band number.
 *
 * Example for Vocabulary class-match count: thresholds [10, 7, 5, 3]
 *   count >= 10 → band 1
 *   count >= 7  → band 2
 *   count >= 5  → band 3
 *   count >= 3  → band 4
 *   count < 3   → band 5
 *
 * @param {number} count
 * @param {number[]} thresholds - 4 descending values
 * @returns {number} 1-5
 */
function bandFromCountDescending(count, thresholds) {
    for (let i = 0; i < thresholds.length; i++) {
        if (count >= thresholds[i]) return i + 1;
    }
    return 5;
}

/**
 * Compute the Grammar band.
 *
 * When class-grammar list is present, averages two bands (error count +
 * class-structure count) and rounds to nearest integer. When class-grammar
 * list is absent, uses only the error-count band — GPT-without-rubric-
 * class-structures fallback is handled upstream by the prompt's
 * "NOT SPECIFIED for this class" branch.
 */
function computeGrammarBand({ errorCount, classStructuresUsedCount, hasClassGrammar }) {
    const errorBand = bandFromCountAscending(errorCount, [3, 5, 9, 15]);
    if (!hasClassGrammar) return errorBand;
    const structureBand = bandFromCountDescending(classStructuresUsedCount, [4, 3, 2, 1]);
    return Math.round((errorBand + structureBand) / 2);
}

/**
 * Compute the Vocabulary band when a class-vocabulary list IS present.
 * Rubric is match-count-based only (no error-count factor for vocab when
 * a class list exists).
 *
 * When no class list exists, returns null — caller should mark Vocabulary
 * as subjective and let GPT judge freely.
 */
function computeVocabularyBand({ classVocabUsedCount, hasClassVocabulary }) {
    if (!hasClassVocabulary) return null;
    return bandFromCountDescending(classVocabUsedCount, [10, 7, 5, 3]);
}

/** Spelling band — pure error count. */
function computeSpellingBand(errorCount) {
    return bandFromCountAscending(errorCount, [3, 5, 8, 10]);
}

/** Mechanics band — pure error count. */
function computeMechanicsBand(errorCount) {
    return bandFromCountAscending(errorCount, [3, 5, 10, 20]);
}

/**
 * Compute the Layout length-deviation band based on the student's actual
 * word count vs target range. Uses the asymmetric thresholds the rubric
 * defines ("N words under OR M words over").
 *
 * Returns null if no target is set (caller should skip length in Layout
 * scoring entirely, per the existing "NOT SPECIFIED" branch).
 */
function computeLayoutLengthBand({ actualCount, targetMin, targetMax }) {
    if (actualCount == null || targetMin == null || targetMax == null) return null;

    // Rubric's per-band thresholds (from the uni; asymmetric under vs over):
    //   band 1: within range OR up to 13 under OR up to 15 over
    //   band 2: 14-15 under OR 16-20 over
    //   band 3: 16-17 under OR 21-25 over
    //   band 4: 18-19 under OR 26-30 over
    //   band 5: 20+ under OR 31+ over
    //
    // Evaluate the relevant side (under or over) only. An essay that is
    // 20 words under target shouldn't match "<=15 over" — we check only the
    // side the deviation actually lands on.

    if (actualCount >= targetMin && actualCount <= targetMax) return 1;

    if (actualCount < targetMin) {
        const under = targetMin - actualCount;
        if (under <= 13) return 1;
        if (under <= 15) return 2;
        if (under <= 17) return 3;
        if (under <= 19) return 4;
        return 5;
    }

    // actualCount > targetMax
    const over = actualCount - targetMax;
    if (over <= 15) return 1;
    if (over <= 20) return 2;
    if (over <= 25) return 3;
    if (over <= 30) return 4;
    return 5;
}

/** Layout transition-word band. */
function computeLayoutTransitionBand(transitionWordCount) {
    return bandFromCountDescending(transitionWordCount, [6, 5, 4, 2]);
}

/**
 * Map a band number (1-5) to the rubric's point range for the category,
 * given the category's weight. Returns { min, max } in points (not percent).
 *
 * Band ranges by weight (follows the rubric's standard 5-band split):
 *   Weight 15: bands give [13-15, 10-12, 7-9, 4-6, 0-3]
 *   Weight 10: bands give [9-10, 7-8, 5-6, 3-4, 0-2]
 *
 * These match the rubric.json bands exactly — just computed from weight
 * so we don't duplicate the thresholds.
 */
function bandToPointRange(band, weight) {
    if (weight === 15) {
        const ranges = [
            { min: 13, max: 15 },
            { min: 10, max: 12 },
            { min: 7, max: 9 },
            { min: 4, max: 6 },
            { min: 0, max: 3 },
        ];
        return ranges[band - 1] || ranges[4];
    }
    if (weight === 10) {
        const ranges = [
            { min: 9, max: 10 },
            { min: 7, max: 8 },
            { min: 5, max: 6 },
            { min: 3, max: 4 },
            { min: 0, max: 2 },
        ];
        return ranges[band - 1] || ranges[4];
    }
    // Fallback: proportional split
    const step = weight / 5;
    return {
        min: Math.max(0, Math.round(weight - band * step)),
        max: Math.round(weight - (band - 1) * step),
    };
}

export {
    countErrorsByCategory,
    bandFromCountAscending,
    bandFromCountDescending,
    computeGrammarBand,
    computeVocabularyBand,
    computeSpellingBand,
    computeMechanicsBand,
    computeLayoutLengthBand,
    computeLayoutTransitionBand,
    bandToPointRange,
};
