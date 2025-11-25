// grader/error-detection-simple.js
// SIMPLIFIED ERROR DETECTION - Mimics ChatGPT's natural error detection

export function buildSimpleErrorDetectionPrompt(classProfile, studentText) {
  return `Point out all the errors in this ESL student essay.

For each error, provide:
1. The error category (spelling, grammar, vocabulary, mechanics, fluency, or delete)
2. The exact text with the error
3. The correction
4. An explanation (optional - see guidelines below)

**Error Categories (in priority order):**

1. **spelling** - Words spelled incorrectly (recieve→receive, tomorow→tomorrow). Does NOT include apostrophe errors (those are mechanics).

2. **grammar** - Structural language errors including:
   - Verb tenses/forms (go→went, is walk→is walking)
   - Subject-verb agreement (he walk→he walks)
   - Articles (a apple→an apple, the dogs is→the dogs are)
   - Pronouns (his→her, they→their)
   - Singular/plural mismatches (one dogs→one dog)
   - Word order within grammatical structures when it breaks grammar rules

3. **vocabulary** - Wrong word chosen where the intended meaning is different (affect→effect, except→accept). NOT for grammar issues or near-synonyms that work contextually.

4. **mechanics** - Punctuation and capitalization ONLY:
   - Missing/wrong punctuation (periods, commas, question marks)
   - Run-on sentences (mark ONLY the 2 words surrounding where the punctuation should go)
   - Capitalization (monday→Monday, i→I)
   - Apostrophes for contractions (dont→don't) and possession (johns→john's)

5. **fluency** - Natural expression and flow issues (ONLY mark if you've found fewer than 25 errors in categories 1-4):
   - Awkward phrasing that is grammatically correct but unnatural
   - Wordy expressions that could be more concise
   - Word order that is technically correct but sounds wrong
   - Unclear or confusing sentence structure that doesn't violate grammar rules

6. **delete** - Redundant or unnecessary words/phrases that should be completely removed (correction should be empty).

**Important Guidelines:**
- Prioritize categories 1-4 (spelling, grammar, vocabulary, mechanics) over fluency
- Only look for fluency errors if the essay has fewer than 25 errors in other categories
- Highlight ONLY the error itself (single words for spelling, minimal phrase for grammar)
- Favor atomic edits - mark as few words as possible for each error
- Be selective - missing errors is better than false positives
- For run-on sentences: mark ONLY the 2 words surrounding where the period should go (mechanics error)

**Explanation Guidelines:**
- Don't provide explanations for spelling errors
- Only explain when it genuinely helps prevent future errors
- Use simple words ESL learners understand

**CRITICAL - Avoid Overlapping Highlights:**
- If the same text has multiple errors, combine them into ONE entry with multiple categories
- Use comma-separated categories for multi-error text
- Never create separate entries for the same exact text span
- Example: "he dont" has both grammar (doesn't with he/she/it) and mechanics (missing apostrophe), mark as ONE error with category: "grammar,mechanics"

Output as a JSON array:
{
  "errors": [
    {
      "category": "spelling",
      "error_text": "recieve",
      "correction": "receive"
    },
    {
      "category": "mechanics",
      "error_text": "dont",
      "correction": "don't",
      "explanation": "Add apostrophe for contraction"
    },
    {
      "category": "grammar",
      "error_text": "He don't like",
      "correction": "He doesn't like",
      "explanation": "Use 'doesn't' with 'he/she/it'"
    },
    {
      "category": "mechanics",
      "error_text": "late, she",
      "correction": "late. She",
      "explanation": "Run-on sentence - add period"
    },
    {
      "category": "fluency",
      "error_text": "in a very quick manner",
      "correction": "quickly",
      "explanation": "More concise phrasing"
    },
    {
      "category": "delete",
      "error_text": "very very",
      "correction": "",
      "explanation": "Remove redundant repetition"
    }
  ]
}

STUDENT TEXT:
"""${studentText}"""`;
}
