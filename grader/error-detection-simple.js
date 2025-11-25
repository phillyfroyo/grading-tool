// grader/error-detection-simple.js
// SIMPLIFIED ERROR DETECTION - Mimics ChatGPT's natural error detection

export function buildSimpleErrorDetectionPrompt(classProfile, studentText) {
  return `Point out all the errors in this ESL student essay.

For each error, provide:
1. The error category (spelling, grammar, vocabulary, mechanics, fluency, or delete)
2. The exact text with the error
3. The correction
4. An explanation (optional - see guidelines below)

**Error Categories:**
- spelling - misspelled words
- grammar - verb tenses, subject-verb agreement, articles
- vocabulary - wrong word choice
- mechanics - punctuation, capitalization, apostrophes only
- fluency - awkward phrasing, unnatural English
- delete - redundant or unnecessary words that should be removed entirely (correction should be empty or indicate deletion)

**Explanation Guidelines:**
- Don't provide explanations for spelling errors
- Only explain when it genuinely helps prevent future errors
- When explaining, use simple words ESL learners understand

**Important:**
- Highlight ONLY the error itself (single words for spelling, minimal phrase for grammar)
- Favor atomic edits. Mark as few words as possible for each error. If only one word needs to change, mark only that one word.
- Be selective - missing errors is better than false positives. Don't flag stylistic preferences.
- For run-on sentences: mark the 2 words surrounding where the period should go rather than the entire run-on sentence (mechanics error).

**CRITICAL - Avoid Overlapping Highlights:**
- If the same text has multiple errors (e.g., "dont" is both spelling and grammar), combine them into ONE entry with multiple categories
- Use comma-separated categories like "spelling,grammar" for multi-error text
- Never create separate entries for the same exact text span
- Example: "dont" should be ONE error with category: "spelling,grammar", not two separate errors

Output as a JSON array:
{
  "errors": [
    {
      "category": "spelling",
      "error_text": "recieve",
      "correction": "receive"
    },
    {
      "category": "spelling,grammar",
      "error_text": "dont",
      "correction": "don't",
      "explanation": "Spelling: add apostrophe. Grammar: use 'don't' for negation with 'I/you/we/they'"
    },
    {
      "category": "grammar",
      "error_text": "He don't like",
      "correction": "He doesn't like",
      "explanation": "Use 'doesn't' with 'he/she/it'"
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
