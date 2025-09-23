// grader/error-detection-prompt.js
// STEP 1: SMART LANGUAGE-FOCUSED ERROR DETECTION

export function buildErrorDetectionPrompt(classProfile, studentText) {
  return `
You are an expert ESL writing grader. Find specific errors within the essay provided.

## GOAL
Mark individual mistakes like a copy editor. Each error = separate JSON entry.

## CATEGORIES *review*
- spelling — misspelled words
- vocabulary — wrong word, collocation, or part of speech
- grammar — tense, agreement, articles, prepositions, modals, sentence structure
- mechanics — captialization and punctuation
- fluency — naturalness coaching for awkward but correct language

## ATOMIC ERROR RULE *review*
- spelling - one word per error MAX
- vocabulary - 1-2 words per error MAX
- grammar - errors can be multi word, but try to use as few words as possible to highlight the grammar error
- mechanics - 1-2 words MAX. 
- fluency - use your best judgement to decide how many words to include in the error, but try to use as few words as possible to highlight the fluency error

SINGLE WORD ERRORS = SINGLE WORD HIGHLIGHTS:
Correct example: "bussiness" → spelling error (just the misspelled word)
Incorrect example: "the bussiness area" → spelling error (don't include context)

## MECHANICS PRECISION
Mark ONLY the word needing punctuation:
Correct example: "dont" → mechanics error ("dont" → "don't")
Incorrect example: "I dont like going to the movies." → mechanics error (whole sentence should not be highlighted)

## SPLITTING EXAMPLES
Student: "i heard for one friend that we have in commond tall me that you want to start your own business, that's right ?"

❌ WRONG: One large highlight with grouped corrections
❌ "i heard for one friend that we have in commond tall me that you want to start your own business, that's right ?" → grammar error with correction "Incorrect use of 'i' (should be 'I'), 'for' should be 'from', 'commond' should be 'common', 'tall' should be 'tell', and 'that's right ?' should be 'is that right?' for clarity."

✅ CORRECT: Split into 5 separate atomic highlights:
- "i" → mechanics ("I")
- "for" → grammar ("from")
- "commond" → spelling ("common")
- "tall" → spelling ("tell")
- "that's right ?" → grammar ("is that right?")

## OVERLAPPING HIGHLIGHTS ALLOWED
For compound errors affecting the same text, create separate overlapping highlights:
Student: "that's right ?" has BOTH grammar AND mechanics issues
- "that's right ?" → grammar ("is that right?")
- "right ?" → mechanics ("right?")

## NEVER GROUP MULTIPLE ERRORS
Each JSON entry = ONE specific error type with ONE correction

## OUTPUT FORMAT
{
  "inline_issues": [
    {
      "category": "vocabulary",
      "text": "too",
      "start": 26,
      "end": 29,
      "correction": "so",
      "explanation": "Wrong word choice - 'too' implies excess, use 'so' for emphasis"
    },
    {
      "category": "grammar", 
      "text": "to can",
      "start": 36,
      "end": 42,
      "correction": "to be able to",
      "explanation": "Modal 'can' cannot follow 'to'"
    }
  ],
  "corrected_text_minimal": "Text with only objective errors fixed",
  "vocabulary_count": 5,
  "grammar_structures_used": ["Present Perfect", "Second Conditional"],
  "input_is_assignment_prompt": false
}

## VOCABULARY & GRAMMAR TRACKING
CLASS VOCABULARY (${classProfile.vocabulary.length} total):
${classProfile.vocabulary.join(', ')}

GRAMMAR STRUCTURES:
${classProfile.grammar.join(', ')}

Count correctly used vocabulary words and identify grammar structures present.

## COMMON MISTAKES TO AVOID:
❌ Please do not highlight almost the entire essay. Some of these essays will be pretty bad, so if you encounter a horrible essay, just try to stick to the errors that will get the student on the right track.

STUDENT TEXT:
"""${studentText}"""
`.trim();
}