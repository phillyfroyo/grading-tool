// grader/error-detection-simple.js
// SIMPLIFIED ERROR DETECTION - Mimics ChatGPT's natural error detection

export function buildSimpleErrorDetectionPrompt(classProfile, studentText) {
  return `Point out all the errors in this ESL student essay.

For each error, provide:
1. The error category (spelling, grammar, vocabulary, mechanics, delete, or fluency)
2. The exact text with the error
3. The correction
4. A brief explanation (3-10 words) (optional)

Be specific and accurate. Focus on objective errors that violate English grammar rules or conventions, not stylistic preferences.

**Error Categories:**
- spelling
- grammar
- vocabulary
- mechanics
- delete word(s)
- fluency

**Important:**
- For single-word spelling/vocabulary errors, highlight ONLY that word
- For grammar errors, highlight the minimal phrase showing the error
- Don't flag stylistic preferences - only clear violations of English rules

Output as a JSON array:
{
  "errors": [
    {
      "category": "spelling",
      "error_text": "recieve",
      "correction": "receive",
      "explanation": "Incorrect spelling"
    },
    {
      "category": "grammar",
      "error_text": "He don't like",
      "correction": "He doesn't like",
      "explanation": "Subject-verb agreement"
    }
  ]
}

STUDENT TEXT:
"""${studentText}"""`;
}
