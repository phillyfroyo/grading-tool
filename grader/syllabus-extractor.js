// grader/syllabus-extractor.js
// Extract class vocabulary and grammar structures from a pasted syllabus.
//
// Uses GPT-4o (low temperature) to parse syllabus text into two arrays.
// UNIT headers and category subheaders are preserved in the output, prefixed
// with "# " and "## " respectively, so teachers can visually organize their
// profile textareas. The grading pipeline strips header lines (anything
// starting with "#") before sending vocab/grammar to the grading GPT call.

import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Build the extraction prompt. Separated into its own function for testability
 * and so future prompt tweaks live in one obvious place.
 */
function buildExtractionPrompt(syllabusText) {
  return `You are extracting class vocabulary and grammar structures from a university-level ESL syllabus that a teacher has pasted.

Your job: return a JSON object with \`vocabulary\` and \`grammar\` arrays, formatted as described below.

## RECOGNIZING STRUCTURE

The syllabus may contain one or more UNITS, each headed like "UNIT 1: GETTING A JOB" or similar. Units contain sections labeled GRAMMAR, VOCABULARY, or topical category names like "Negotiation Terminology" or "Workplace Lingo". Under each section are the actual items (words, phrases, structures).

**Important**: Syllabi often have formatting inconsistencies, categorization errors, tables, and mixed content. Use your judgment — don't blindly trust section labels. If a "GRAMMAR" section clearly contains vocabulary (chart-description words, phrase banks, example sentences), treat those words as vocabulary regardless of where they appeared. Your goal is semantic correctness, not literal adherence to the syllabus's structure.

## ORGANIZATIONAL HEADERS — PRESERVE in output

- Mark UNIT headers with a leading "# " prefix. Example: "# UNIT 1: GETTING A JOB"
- Mark category subheaders (e.g. "HR Processes", "Workplace Lingo", "Negotiation Terminology") with a leading "## " prefix. Example: "## HR Processes"
- Headers appear in the array where their items belong. If a unit's vocab section has items, the unit header and any relevant subheaders appear in the \`vocabulary\` array above those items. Same pattern for grammar.
- Do NOT preserve the words "GRAMMAR", "VOCABULARY", "VOCAB", or similar section labels as subheaders — those just indicate which output array the items go in, they are not useful organizational markers for the teacher.
- Do NOT preserve course-level headers like "LEVEL 6 (B2+/C1) BUSINESS ENGLISH" or "VOCABULARY LIST AND CURRICULUM GUIDE" — skip these entirely.

## WHAT TO EXTRACT

- **Vocabulary items**: individual words or short lexical phrases taught as target vocab (e.g., "negotiate", "compensation package", "skyrocket", "fringe benefits"). These belong in the \`vocabulary\` array.
- **Grammar items**: grammatical patterns, tenses, or constructions taught as target grammar (e.g., "Present Perfect", "Indirect Questions", "Not only..., but also...", "Inverted Conditionals"). These belong in the \`grammar\` array.

## WHAT TO SKIP

- **Example sentences** (e.g., "The bar graph compares the sales figures..."). These are illustrations, not items.
- **Instructional text** (e.g., "How to Use These Expressions", "You can use both the noun and verb form").
- **Course metadata**: course codes, CEFR levels, page numbers, "VOCABULARY LIST AND CURRICULUM GUIDE", instructor names, dates.
- **Section labels** like "GRAMMAR" or "VOCABULARY" themselves.
- **Numbering** (1., 2., 3., etc.) — strip it from each item.
- **Bullet markers** (•, o, -, *) — strip them.
- **Language functions and discourse skills** that aren't real grammar structures. These are high-level teaching goals, not grammatical patterns a student's essay can be checked against. Examples of items to skip from the grammar output:
  - "Interpreting data in graphics and reports"
  - "Giving presentations"
  - "Describing trends"
  - "Negotiating"
  - "Writing emails"
  Real grammar items name specific patterns (tenses, conditionals, question forms, subjunctive mood, passive voice, specific construction templates). If an item reads as an activity or skill rather than a linguistic pattern, skip it.

## HANDLING COMPRESSED NOTATION

- Expand compressed comma notation when it clearly lists multiple items. For example, "Present (Simple, continuous, perfect simple, perfect continuous)" should be expanded into 4 separate items: "Present Simple", "Present Continuous", "Present Perfect Simple", "Present Perfect Continuous".
- Expand hierarchical bullet lists. If you see "Advanced Question Structures" with sub-bullets "Indirect / Embedded / Hypothetical", expand them into "Indirect Questions", "Embedded Questions", "Hypothetical Questions" — inherit the parent concept into each sub-item to produce specific, useful items.

**CRITICAL exception — ellipsis-templated structures:**

Entries that contain ellipses (...) are single templates that must be preserved as ONE item, never split on commas. The ellipses signal a single grammatical pattern with placeholder slots. Examples of things that must stay as ONE item:

- "Not only..., but also..." → ONE item (a correlative conjunction template)
- "Suppose, (just) imagine, what if, let's ..." → ONE item (a template listing hypothetical-framing verbs as a single teaching concept)
- "On the one hand..., on the other hand..." → ONE item
- "The more..., the more..." → ONE item

The presence of \`...\` or \`…\` anywhere in a line means "this is one template, not a list of separate items." Do NOT split on commas when ellipses are present.

- If in doubt on NON-ellipsis items, prefer keeping items separate over merging them.
- **Do not create duplicate entries.** If the same text would appear twice (e.g., once as a parent category label and once as a child item expanded from a parenthetical), keep only ONE copy. Prefer the more specific version.

## HANDLING UNNUMBERED WORD LISTS, TABLES, AND PHRASE BANKS

**Important: vocabulary items are NOT always numbered or bulleted.** Sometimes syllabi list vocabulary as bare words separated by newlines or grouped into columns by blank lines. Treat unnumbered word groups as vocabulary just as carefully as you would numbered lists.

Specifically, if you see any of the following, extract EVERY individual word or phrase as a vocabulary item (NOT as grammar):

1. **Columns of single words separated by blank lines.** Example:
   \`\`\`
   diagram
   table
   figure
   graph

   shows
   represents
   depicts
   \`\`\`
   Extract ALL of these words (diagram, table, figure, graph, shows, represents, depicts, ...) as vocabulary. Each word becomes its own entry.

2. **Chart/graph description tables** — rows of chart types, description verbs, focus phrases, or trend words. Extract every cell as a vocabulary item.

3. **Phrase banks** — groups of multi-word phrases intended for students to use (e.g., "the comparison of", "the trend of", "information on"). Extract each phrase as a vocabulary item.

4. **Slash-separated alternatives** — items like "rise / increase", "fall / decrease", "unchanged / level out / remain constant". **Split these into individual vocab items on the slashes** — so "rise / increase" becomes two items: "rise" and "increase", and "unchanged / level out / remain constant" becomes three items. The slash syntax means "either of these words is acceptable" rather than "this exact phrase."

**Critical**: do NOT skip unnumbered word lists just because they appear under a "GRAMMAR" section label or because they're followed by example sentences. The "GRAMMAR" label is sometimes a syllabus categorization error — use your judgment and classify content by what it actually is.

**AFTER extracting the table or phrase bank contents**, then skip what follows:
- Example sentences (usually in quotes) that demonstrate how to use the words
- Meta-instructions like "How to Use These Expressions" followed by bulleted prose explanations
- Parenthetical guidance notes like "You can use both the noun and verb form of these words" or "(make into a noun also)"

## OUTPUT FORMAT

Return this exact JSON structure:
{
  "vocabulary": ["# UNIT 1: GETTING A JOB", "## Negotiation Terminology", "Initial offer", "Counter-offer", ...],
  "grammar": ["# UNIT 1: GETTING A JOB", "Indirect Questions", "Embedded Questions", "Present Simple", ...]
}

The header markers (\`#\` and \`##\`) organize the lists visually for the teacher in the profile textarea — they will be automatically stripped before grading happens, so they do not affect scoring.

If you cannot confidently extract anything (e.g., the text is clearly not a syllabus), return empty arrays: \`{"vocabulary": [], "grammar": []}\`.

## SYLLABUS TEXT:
"""
${syllabusText}
"""`;
}

/**
 * Extract vocabulary and grammar from pasted syllabus text.
 *
 * @param {string} syllabusText - Raw text pasted from a syllabus by the user.
 * @returns {Promise<{vocabulary: string[], grammar: string[]}>}
 * @throws {Error} If the GPT call fails or the response cannot be parsed.
 */
export async function extractSyllabus(syllabusText) {
  if (!syllabusText || !syllabusText.trim()) {
    throw new Error('Syllabus text is empty');
  }

  const prompt = buildExtractionPrompt(syllabusText);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1, // Low temperature for consistency — same input should produce same output
    response_format: { type: "json_object" }
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('GPT returned no content');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error('GPT returned invalid JSON: ' + err.message);
  }

  // Defensive: ensure both arrays exist even if GPT omits one.
  const vocabulary = Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [];
  const grammar = Array.isArray(parsed.grammar) ? parsed.grammar : [];

  // Trim whitespace, drop empty strings, and deduplicate while preserving
  // insertion order. Header markers are kept intact. Deduplication catches
  // cases where GPT creates both a parent label and a child item with the
  // same text (e.g., "Inverted conditionals" appearing as both a category
  // label and an expanded parenthetical).
  const clean = (arr) => {
    const seen = new Set();
    const out = [];
    for (const raw of arr) {
      if (typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      if (!trimmed) continue;
      // Case-insensitive dedup key so "Inverted conditionals" and
      // "inverted conditionals" collapse to one entry (keeps first casing).
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
    return out;
  };

  return {
    vocabulary: clean(vocabulary),
    grammar: clean(grammar),
  };
}
