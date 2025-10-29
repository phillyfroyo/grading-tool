// grader/error-detection-simple.js
// SIMPLIFIED ERROR DETECTION - Mimics ChatGPT's natural error detection

export function buildSimpleErrorDetectionPrompt(classProfile, studentText) {
  return `Point out all the errors in this ESL student essay.

For each error, provide:
1. The error category (spelling, grammar, vocabulary, mechanics, delete, or fluency)
2. The exact text with the error
3. The correction
4. An explanation (optional - see guidelines below)

Focus on clear errors that violate English rules. Don't flag stylistic preferences.

**Error Categories:**
- spelling
- grammar
- vocabulary
- mechanics
- delete (for unnecessary words that should be removed)
- fluency

**Explanation Guidelines:**
- Don't provide explanations for spelling errors
- Only explain when it genuinely helps prevent future errors
- When explaining, use simple words ESL learners understand

**Important:**
- Highlight ONLY the error itself (single words for spelling, minimal phrase for grammar)
- Be selective - missing errors is better than false positives

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
