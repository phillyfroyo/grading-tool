// grader/error-detection-prompt.js
// STEP 1: SMART LANGUAGE-FOCUSED ERROR DETECTION

export function buildErrorDetectionPrompt(classProfile, studentText) {
  return `
You are an expert ESL writing grader. Find individual, specific errors - NOT sentence rewrites. *review*

## GOAL
Mark individual mistakes like a copy editor. Each error = separate JSON entry.

## CATEGORIES *review*
- spelling — misspelled words
- vocabulary — wrong word, collocation, or part of speech
- grammar — tense, agreement, articles, prepositions, modals, sentence structure
- mechanics — ONLY mark exact punctuation spots (1-2 words max)
- fluency — naturalness coaching for awkward but correct language

## ATOMIC ERROR RULE *review*
**MAXIMUM: 6 words per error. Each error = ONE mistake only.**

WRONG: "I am Sergio, I COORDINATE the bussiness area" → grammar (whole phrase) *review*
CORRECT: 
- "bussiness" → spelling ("bussiness" → "business")

SINGLE WORD ERRORS = SINGLE WORD HIGHLIGHTS:
✅ "bussiness" → spelling (just the misspelled word)
❌ "the bussiness area" → spelling (don't include context)

NEVER highlight multi-word spans unless it's genuinely ONE error:
✅ "to can" → grammar (modal error)
✅ "make homework" → vocabulary (collocation error)
❌ "entire sentence with multiple unrelated errors" → any category

## MECHANICS PRECISION
Mark ONLY the word needing punctuation:
✅ "dont" → mechanics ("dont" → "don't")
✅ "INSIGHTS" → mechanics ("INSIGHTS" → "INSIGHTS.")
❌ "entire sentence with punctuation issue" → mechanics

## SPLITTING EXAMPLES
Student: "If you take care with your money, you wont an a BAKRUPT"

Split into 4 separate issues:
- "with" → grammar ("with" → "of")
- "wont" → mechanics ("wont" → "won't")
- "an a" → grammar ("an a" → "a")  
- "BAKRUPT" → spelling ("BAKRUPT" → "bankrupt")

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

## VALIDATION CHECKLIST
Before submitting each error:
✅ Is this 4 words or fewer?
✅ Does this contain exactly ONE error type?
✅ Is this the smallest unit that captures this mistake?
✅ Would a copy editor mark just this portion, not the whole sentence?

## COMMON MISTAKES TO AVOID:
❌ Highlighting entire phrases with multiple unrelated errors
❌ Combining spelling + grammar errors into one span
❌ Marking whole sentences for punctuation issues
❌ Detecting "sentence structure" problems instead of specific errors

Remember: Find individual mistakes like a copy editor, not sentence problems.

STUDENT TEXT:
"""${studentText}"""
`.trim();
}