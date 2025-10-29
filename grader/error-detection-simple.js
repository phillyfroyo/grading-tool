// grader/error-detection-simple.js
// SIMPLIFIED ERROR DETECTION - Mimics ChatGPT's natural error detection

export function buildSimpleErrorDetectionPrompt(classProfile, studentText) {
  return `Point out all the errors in this ESL student essay.

For each error, provide:
1. The error category (spelling, grammar, vocabulary, mechanics, delete, or fluency)
2. The exact text with the error
3. The correction
4. An explanation (optional - see guidelines below)

**Error Categories:**
- spelling - misspelled words
- grammar - verb tenses, subject-verb agreement, articles
- vocabulary - wrong word choice
- mechanics - punctuation, capitalization, apostrophes only
- delete - unnecessary words
- fluency - awkward phrasing, unnatural English

**Explanation Guidelines:**
- Don't provide explanations for spelling errors
- Only explain when it genuinely helps prevent future errors
- When explaining, use simple words ESL learners understand

**Important:**
- Highlight ONLY the error itself (single words for spelling, minimal phrase for grammar)
- Favor atomic edits. Mark as few words as possible for each error. If only one word needs to change, mark only that one word.
- Be selective - missing errors is better than false positives. Don't flag stylistic preferences.
- For run-on sentences: mark the 2 words surrounding where the period should go rather than the entire run-on sentence (mechanics error).

Output as a JSON array:
{
  "errors": [
    {
      "category": "spelling",
      "error_text": "recieve",
      "correction": "receive"
    },
    {
      "category": "grammar",
      "error_text": "He don't like",
      "correction": "He doesn't like",
      "explanation": "Use 'doesn't' with 'he/she/it'"
    }
  ]
}

STUDENT TEXT:
"""${studentText}"""`;
}
