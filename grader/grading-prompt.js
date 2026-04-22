// grader/grading-prompt.js
// STEP 2: RUBRIC-BASED GRADING

/**
 * Strip organizational header lines (lines starting with "#") from a vocab
 * or grammar list. See grader-simple.js stripHeaders() for the full rationale;
 * this is a local copy so grading-prompt.js stays import-free.
 */
function stripHeaders(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(item => typeof item === 'string' && !item.trim().startsWith('#'));
}

/**
 * Parse a required word count range out of free-text prompt content.
 *
 * Teachers have historically encoded length requirements inline in the
 * class profile's prompt textarea ("write 200-220 words about X"). This
 * parser recognizes common phrasings and extracts a {min, max} range so
 * the grading prompt can pass explicit targets to GPT instead of hoping
 * the model reads the prompt correctly.
 *
 * Returns null if no pattern matches. Always anchors on the word "words"
 * (optionally plural/apostrophe) to avoid catching numbers that refer to
 * pages, minutes, paragraphs, CEFR levels, etc.
 *
 * Supported phrasings:
 *   "200-220 words" / "200–220 words" (en dash)
 *   "200 to 220 words"
 *   "between 200 and 220 words"
 *   "at least 200 words"            → {min: 200, max: null}
 *   "at most 220 words"             → {min: null, max: 220}
 *   "around 210 words"              → {min: 189, max: 231}  (±10%)
 *   "approximately 210 words"       → {min: 189, max: 231}
 *   "about 210 words"               → {min: 189, max: 231}
 *   "~210 words"                    → {min: 189, max: 231}
 *   "210 words"                     → {min: 189, max: 231}  (bare number treated as approximate target)
 *
 * @param {string} promptText
 * @returns {{min: number|null, max: number|null} | null}
 */
function parseWordCountFromPrompt(promptText) {
  if (!promptText || typeof promptText !== 'string') return null;

  // Normalize en/em dashes to hyphen so one regex handles all three.
  const text = promptText.replace(/[\u2013\u2014]/g, '-');

  // "between 200 and 220 words" — check first because it contains "and"
  // which could conflict with a naive range match.
  const between = text.match(/between\s+(\d+)\s+and\s+(\d+)\s+words?\b/i);
  if (between) {
    const a = parseInt(between[1], 10);
    const b = parseInt(between[2], 10);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }

  // "200-220 words" or "200 to 220 words"
  const range = text.match(/(\d+)\s*(?:-|to)\s*(\d+)\s*words?\b/i);
  if (range) {
    const a = parseInt(range[1], 10);
    const b = parseInt(range[2], 10);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }

  // "at least 200 words" — floor only
  const atLeast = text.match(/(?:at\s+least|minimum(?:\s+of)?|no\s+less\s+than)\s+(\d+)\s+words?\b/i);
  if (atLeast) {
    return { min: parseInt(atLeast[1], 10), max: null };
  }

  // "at most 220 words" / "no more than 220 words" — ceiling only
  const atMost = text.match(/(?:at\s+most|maximum(?:\s+of)?|no\s+more\s+than|up\s+to)\s+(\d+)\s+words?\b/i);
  if (atMost) {
    return { min: null, max: parseInt(atMost[1], 10) };
  }

  // "around 210 words" / "approximately 210" / "about 210" / "~210"
  // Treat as target ±10% so GPT has a range to score Layout against.
  const approx = text.match(/(?:around|approximately|about|roughly|~)\s*(\d+)\s+words?\b/i);
  if (approx) {
    const n = parseInt(approx[1], 10);
    return { min: Math.round(n * 0.9), max: Math.round(n * 1.1) };
  }

  // Bare "210 words" — treat same as approximate target.
  // Require the number to be at least 20 to avoid matching things like
  // "2 words" or "10 words" which are more likely part of some other
  // instruction than a length requirement.
  const bare = text.match(/(?:^|[^-\d])(\d+)\s+words?\b/i);
  if (bare) {
    const n = parseInt(bare[1], 10);
    if (n >= 20) {
      return { min: Math.round(n * 0.9), max: Math.round(n * 1.1) };
    }
  }

  return null;
}

/**
 * Resolve the required word count for a grading run.
 *
 * Precedence (highest to lowest):
 *   1. Explicit schema fields requiredWordCountMin / requiredWordCountMax
 *      set by the teacher in the profile edit modal.
 *   2. Regex-parsed target from the free-text prompt.
 *   3. Null — no target. Caller should skip word-count scoring.
 *
 * Either bound may be null even when a target is found (e.g. "at least 200"
 * yields {min: 200, max: null}). Callers must handle partial ranges.
 */
function resolveWordCountRange(classProfile) {
  // Schema fields win outright if EITHER is set. Null means "unset" (see
  // normalizeWordCount in profileService.js). If the teacher filled in only
  // one bound we honor that half.
  const schemaMin = classProfile.requiredWordCountMin;
  const schemaMax = classProfile.requiredWordCountMax;
  const hasSchemaValue =
    (schemaMin !== null && schemaMin !== undefined) ||
    (schemaMax !== null && schemaMax !== undefined);
  if (hasSchemaValue) {
    return {
      min: (schemaMin !== null && schemaMin !== undefined) ? schemaMin : null,
      max: (schemaMax !== null && schemaMax !== undefined) ? schemaMax : null,
    };
  }

  // Fall back to regex parse of the prompt text.
  const parsed = parseWordCountFromPrompt(classProfile.prompt || '');
  return parsed; // null if nothing matched
}

// Export helpers for testing / other modules.
export { parseWordCountFromPrompt, resolveWordCountRange };

export function buildGradingPrompt(rubric, classProfile, cefrLevel, studentText, errorDetectionResults, studentNickname, studentWordCount, precomputed) {
  const levelInfo = rubric.cefr_levels[cefrLevel] || rubric.cefr_levels['C1'];
  const categories = Object.keys(rubric.categories);

  const studentName = studentNickname && studentNickname.trim() ? studentNickname.trim() : '';

  // Resolve the required word count target. Precedence: schema fields first,
  // then regex parse of the prompt, else null (no target set — Layout will
  // be scored on structure/transitions only).
  const wordCountTarget = resolveWordCountRange(classProfile);
  const hasActualCount = typeof studentWordCount === 'number' && !Number.isNaN(studentWordCount);

  // Build the word-count section of the prompt. Three cases:
  //   (a) target known, actual count known → show both, explicit math
  //   (b) target known, actual count missing → show target only
  //   (c) no target → instruct GPT to skip length from Layout scoring
  let wordCountSection;
  if (wordCountTarget) {
    const { min, max } = wordCountTarget;
    const targetLine = (min !== null && max !== null)
      ? `Required word count: **${min}–${max} words**`
      : (min !== null)
        ? `Required word count: **at least ${min} words**`
        : `Required word count: **at most ${max} words**`;

    const actualLine = hasActualCount
      ? `Student's actual word count: **${studentWordCount} words** (algorithmically counted — use this number, do not recount)`
      : '';

    // Compute the deviation so GPT doesn't have to do the arithmetic. Only
    // meaningful when we have both a target range and an actual count.
    let deviationLine = '';
    if (hasActualCount && min !== null && max !== null) {
      let deviation;
      if (studentWordCount < min) {
        deviation = `${min - studentWordCount} words under target`;
      } else if (studentWordCount > max) {
        deviation = `${studentWordCount - max} words over target`;
      } else {
        deviation = 'within target range';
      }
      deviationLine = `Length deviation: **${deviation}**`;
    }

    wordCountSection = [targetLine, actualLine, deviationLine]
      .filter(Boolean)
      .join('\n- ');
    wordCountSection = '- ' + wordCountSection;
  } else {
    // No target set. Layout's band descriptions mention length, but with no
    // target there is nothing to compare against. Tell GPT explicitly so it
    // doesn't invent one.
    const actualLine = hasActualCount
      ? `- Student's actual word count: ${studentWordCount} words (no target set for this assignment)`
      : '';
    wordCountSection = [
      '- Word count: **NOT SPECIFIED for this assignment.** Do NOT penalize the student for length in the Layout category — score Layout based ONLY on structure, paragraphing, and transition-word usage. Do NOT mention word count, length targets, or essay length in the Layout rationale or any other rationale.',
      actualLine,
    ].filter(Boolean).join('\n');
  }

  // Count errors by category and find the top categories
  const errorCounts = {};
  errorDetectionResults.inline_issues.forEach(issue => {
    const cat = issue.category || issue.type || 'unknown';
    errorCounts[cat] = (errorCounts[cat] || 0) + 1;
  });

  // Find the top 2 categories with the most errors (names only, no counts)
  const sortedErrors = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]);
  const topCategories = sortedErrors.slice(0, 2).map(([cat]) => cat).join(' and ');
  const hasMultipleIssues = sortedErrors.length > 1;

  // Strip organizational header lines (# UNIT X, ## Category) from the lists
  // before using them in the grading prompt. Headers are for teacher readability
  // in the profile UI; they are not real vocab/grammar items.
  const cleanVocab = stripHeaders(classProfile.vocabulary);
  const cleanGrammar = stripHeaders(classProfile.grammar);

  // Only include class-list metric lines when the class profile actually specifies them.
  // When empty, we omit these lines entirely so GPT cannot pattern-match "none" or "0"
  // into a rationale like "no class vocabulary used".
  const hasClassVocabulary = cleanVocab.length > 0;
  const hasClassGrammar = cleanGrammar.length > 0;

  const classMetricsLines = [];
  if (hasClassVocabulary) {
    classMetricsLines.push(`CLASS VOCABULARY MATCHES: ${errorDetectionResults.class_vocabulary_used?.length || 0}`);
  }
  if (hasClassGrammar) {
    classMetricsLines.push(`CLASS GRAMMAR STRUCTURES MATCHED: ${errorDetectionResults.grammar_structures_used?.join(', ') || 'none'}`);
  }
  const classMetricsBlock = classMetricsLines.length > 0 ? '\n' + classMetricsLines.join('\n') : '';

  // Build the AUTHORITATIVE ERROR COUNTS + PRECOMPUTED BANDS sections.
  // These only appear when precomputed data is available (i.e. the new
  // scoring pipeline — backward-compatible for any legacy caller).
  let authoritativeBlock = '';
  if (precomputed) {
    const ec = precomputed.errorCounts || {};
    const b = precomputed.bands || {};
    const toPts = precomputed.bandToPointRange;

    // Format one per-category line like:
    //   - Mechanics: 2 errors → band 1 → score in 13-15 range
    const lines = [];
    const addBandLine = (name, band, weight, count, structuresInfo) => {
      if (band == null) return; // subjective — handled elsewhere
      const { min, max } = toPts(band, weight);
      const base = count != null ? `${count} errors` : '';
      const extra = structuresInfo || '';
      const detail = [base, extra].filter(Boolean).join(', ');
      lines.push(`- **${name}**: ${detail ? detail + ' → ' : ''}band ${band} → score in ${min}-${max} range`);
    };

    addBandLine('Grammar', b.grammar, 15, ec.grammar || 0,
      precomputed.hasClassGrammar
        ? `${precomputed.classStructuresUsedCount} class grammar structures used`
        : null);
    if (b.vocabulary != null) {
      // Class-vocab-present case: score is determined by match count only.
      lines.push(`- **Vocabulary**: ${precomputed.classVocabUsedCount} class vocabulary words used → band ${b.vocabulary} → score in ${toPts(b.vocabulary, 15).min}-${toPts(b.vocabulary, 15).max} range`);
    }
    addBandLine('Spelling', b.spelling, 15, ec.spelling || 0);
    addBandLine('Mechanics', b.mechanics, 15, ec.mechanics || 0);

    // Layout has two precomputed sub-bands (length, transitions) plus a
    // structure judgment that GPT provides. We tell GPT the two numeric
    // bands and instruct it to average with its structure assessment.
    const layout = precomputed.layout || {};
    const layoutDetails = [];
    if (layout.lengthBand != null) {
      layoutDetails.push(`length band = ${layout.lengthBand}`);
    } else {
      layoutDetails.push(`length = NOT SCORED (no word count target set)`);
    }
    layoutDetails.push(`transition-word band = ${layout.transitionBand} (${layout.transitionWordCount} transitions found)`);
    layoutDetails.push(`paragraph count = ${layout.paragraphCount}`);

    const layoutStructureInstruction = (layout.lengthBand != null)
      ? `Read the essay and assign a structure-quality band (1-5) based on paragraph organization. Then AVERAGE the three band numbers (length, transitions, structure) and round to the nearest integer. Map the final band to its point range: band 1 → 13-15, band 2 → 10-12, band 3 → 7-9, band 4 → 4-6, band 5 → 0-3. Select a specific point value within that range.`
      : `No word count target set for this assignment. Score Layout from two inputs only: (1) transition-word band = ${layout.transitionBand}, (2) your judgment of paragraph organization as a band (1-5). AVERAGE these two band numbers, round, and map to the point range. Do NOT penalize length.`;

    authoritativeBlock = `
## AUTHORITATIVE SCORING DATA (precomputed from the detected errors — USE THESE EXACT NUMBERS):

${lines.join('\n')}

### Layout (${15} points) — partial precomputation:
- ${layoutDetails.join('\n- ')}

${layoutStructureInstruction}

### Subjective categories (no precomputation):
- **Fluency** (10 points): Read the essay and assign a band 1-5 based on organization and logical flow of ideas. Map to point range: band 1 → 9-10, band 2 → 7-8, band 3 → 5-6, band 4 → 3-4, band 5 → 0-2.
- **Content** (15 points): Read the essay and the assignment prompt. Assign a band 1-5 based on variety of ideas, elaboration, and topic relevance. Map to point range: band 1 → 13-15, band 2 → 10-12, band 3 → 7-9, band 4 → 4-6, band 5 → 0-3.${b.vocabulary == null ? `
- **Vocabulary** (15 points): No class vocabulary list is specified for this assignment. Read the essay and score vocabulary based on variety, appropriateness, and accuracy of the words the student used. Assign a band 1-5 and map to point range: band 1 → 13-15, band 2 → 10-12, band 3 → 7-9, band 4 → 4-6, band 5 → 0-3. Do NOT mention "class vocabulary" in the rationale.` : ''}

### CRITICAL RULE:
For Grammar, Spelling, Mechanics${b.vocabulary != null ? ', and Vocabulary' : ''}: the bands above are FINAL. Pick a point value inside the given range but DO NOT change bands based on your reading of the essay. The error counts are authoritative; your reading of the essay applies ONLY to Fluency, Content, Layout structure${b.vocabulary == null ? ', and Vocabulary' : ''}.
`;
  }

  return `You are an expert ESL writing grader. Grade according to the rubric.

## YOUR JOB
Assign accurate scores based on the rubric. Errors are already detected. Provide feedback according to the actual essay quality.

ERRORS PROVIDED: ${errorDetectionResults.inline_issues.length} total errors found${classMetricsBlock}

## GRADING MINDSET
- Follow the rubric objectively while maintaining a supportive tone
- Score based on demonstrated competency with growth-oriented feedback
- Provide accurate assessment that celebrates things done correctly and guides improvement
- Focus on student effort and potential, not just current deficiencies

CEFR Level: ${cefrLevel} (${levelInfo.name})

## ZERO SCORE RULES (automatic 0 if any apply):
${rubric.zero_rules.map(rule => `- ${rule}`).join('\n')}

## GRADING CATEGORIES:
${categories.map(cat => {
  const category = rubric.categories[cat];
  return `${category.name} (${category.weight} points):
${category.bands.map(band => `  ${band.range}: ${band.description}`).join('\n')}`;
}).join('\n\n')}


## POINT VALUES (use these exact values):
- Grammar: out_of = 15
- Vocabulary: out_of = 15
- Spelling: out_of = 15
- Mechanics: out_of = 15
- Fluency: out_of = 10
- Layout: out_of = 15
- Content: out_of = 15

## ASSIGNMENT PROMPT:
${classProfile.prompt || 'No specific prompt provided'}

## REQUIREMENTS:
${wordCountSection}
- Transition words: ${rubric.layout_rules.transition_words_min} minimum
${hasClassVocabulary
  ? `- Class vocabulary to look for: ${cleanVocab.join(', ')}`
  : `- Class vocabulary: NOT SPECIFIED for this class. Grade the "vocabulary" category based ONLY on the correctness, appropriateness, and variety of the vocabulary the student actually used in their essay. Do NOT mention class vocabulary, a class word list, or whether the student used class vocabulary anywhere in the rationale or feedback. Do NOT say things like "no class vocabulary used" or "class vocabulary not applied".`}
${hasClassGrammar
  ? `- Grammar structures to look for: ${cleanGrammar.join(', ')}`
  : `- Grammar structures: NOT SPECIFIED for this class. Grade the "grammar" category based ONLY on the correctness of the grammar the student actually used in their essay. Do NOT mention target grammar structures, a class grammar list, or whether the student used class grammar anywhere in the rationale or feedback. Do NOT say things like "no class grammar structures used" or "target structures not applied".`}

## SCORING RULES:
- Use the AUTHORITATIVE SCORING DATA above as the source of truth for bands.
- For categories with a precomputed band: the band is FINAL. Pick any point value within the given range based on rubric-band nuance, but do NOT shift to a different band.
- For subjective categories: read the essay and pick a band 1-5, then map to the point range specified above.
- Perfect performance within a band = top of that range. Average performance = middle. Barely meeting band criteria = bottom of range.
${authoritativeBlock}

## STUDENT TEXT:
"${studentText}"

## DETECTED ERRORS:
${errorDetectionResults.inline_issues.map(issue =>
  `- ${issue.category || issue.type}: ${issue.text} → ${issue.correction}`
).join('\n')}

## OUTPUT FORMAT:
{
  "scores": {
    "grammar": {"points": X, "out_of": 15, "rationale": "Brief note explaining score (1 sentence)"},
    "vocabulary": {"points": X, "out_of": 15, "rationale": "Brief note explaining score (1 sentence)"},
    "spelling": {"points": X, "out_of": 15, "rationale": "Brief note explaining score (1 sentence)"},
    "mechanics": {"points": X, "out_of": 15, "rationale": "Brief note explaining score (1 sentence)"},
    "fluency": {"points": X, "out_of": 10, "rationale": "Brief note explaining score (1 sentence)"},
    "layout": {"points": X, "out_of": 15, "rationale": "Brief note explaining score (1 sentence)"},
    "content": {"points": X, "out_of": 15, "rationale": "Brief note explaining score (1 sentence)"}
  },
  "total": {"points": X, "out_of": 100},
  "teacher_notes": "See format below"
}

## RATIONALE FORMAT:
For each category rationale, write 1 brief sentence that:
- Explains why the student received this score
- References specific strengths or areas for improvement
- Uses supportive language (e.g., "Good use of transitions" or "Let's work on tense consistency")
- No exclamation marks

## TEACHER_NOTES FORMAT:

Structure: [Name prefix + Intro] + [ONE sentence mentioning 1-2 areas to improve] + [Closing]

Pick ONE intro based on total score. ${studentName ? `The student's name is "${studentName}" — you MUST start the teacher notes with exactly "${studentName} - " followed by the intro text (or, for the 0-49 case where there is no intro, followed directly by the feedback sentence). This name prefix is required, not optional.` : 'There is no student name — start with the intro text directly.'}

Intros by score:
- 0-49: (no intro — ${studentName ? `start with "${studentName} - " then go directly into the feedback sentence` : 'start directly with the feedback sentence'})
- 50-59: ${studentName ? `"${studentName} - Not too bad overall."` : '"Not too bad overall."'}
- 60-69: ${studentName ? `"${studentName} - Good work here."` : '"Good work here."'}
- 70-79: ${studentName ? `"${studentName} - I think you did a great job overall."` : '"I think you did a great job overall."'}
- 80-89: ${studentName ? `"${studentName} - Great job overall."` : '"Great job overall."'}
- 90-100: ${studentName ? `"${studentName} - Excellent work overall."` : '"Excellent work overall."'}

The areas that need the most attention: ${topCategories || 'none'}.
Write ONE sentence about ${hasMultipleIssues ? 'one or both of these areas' : 'this area'}.
Choose from phrases like:
- "Let's focus on [category] going forward."
- "Let's work on [categories], as these need the most attention."
- "Keep practicing [categories] - that's where we can improve most."
- "Next time, pay extra attention to [categories]."
NEVER include numbers or counts in the teacher notes.

CRITICAL RULES:
- Write exactly ONE feedback sentence - do NOT write two sentences that say the same thing differently
- No exclamation marks
- Always end with: "See detailed notes below the color-coded essay."

Return ONLY valid JSON.`;
}
