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

## CORRECTION AND EXPLANATION FORMATTING
- **correction**: MANDATORY - ALWAYS REQUIRED - Provide ONLY the corrected text that should replace the highlighted error
- **explanation**: OPTIONAL - Provide only when educational value is high (not for simple spelling)

**CRITICAL: EVERY ERROR MUST HAVE A CORRECTION FIELD**
- The correction field is NEVER optional - it must be present for EVERY error
- For correction field, provide ONLY the replacement text (no extra words)
- Example: If student wrote "response" but meant "respond", correction should be: "respond"
- Do NOT include phrases like "should be" or "Final text should be" in correction field

**EXPLANATION FIELD GUIDELINES (OPTIONAL):**
- Only add explanation when it adds educational value
- Skip explanation for simple/obvious errors (common misspellings like "teh" → "the")
- Include explanation for complex grammar rules or confusing vocabulary choices
- Keep explanations very brief (5-10 words max)
- Focus on the "why" not the "what"

## OUTPUT FORMAT
{
  "inline_issues": [
    {
      "category": "vocabulary",
      "text": "too",
      "start": 26,
      "end": 29,
      "correction": "so",
      "explanation": "'too' implies excess"
    },
    {
      "category": "grammar",
      "text": "to can",
      "start": 36,
      "end": 42,
      "correction": "to be able to",
      "explanation": "Modal 'can' cannot follow 'to'"
    },
    {
      "category": "spelling",
      "text": "recieve",
      "start": 50,
      "end": 57,
      "correction": "receive"
    }
  ],
  "corrected_text_minimal": "Text with only objective errors fixed",
  "vocabulary_count": 5,
  "class_vocabulary_used": ["amazing", "incredible", "however"],
  "grammar_structures_used": ["Present Perfect", "Second Conditional"],
  "transition_words_found": ["however", "moreover", "therefore"],
  "input_is_assignment_prompt": false
}

## VOCABULARY & GRAMMAR TRACKING
CLASS VOCABULARY (${classProfile.vocabulary.length} total):
${classProfile.vocabulary.join(', ')}

GRAMMAR STRUCTURES:
${classProfile.grammar.join(', ')}

**VOCABULARY COUNTING INSTRUCTIONS:**
- Count exact matches from the vocabulary list (case-insensitive)
- Count words that use the specified prefixes (un-, re-, in-/im-/il-/ir-, dis-, pre-, mis-, non-, inter-, sub-, super-, anti-)
- Count words that use the specified suffixes (-able/-ible, -ive, -ness, -ment, -tion/-sion, -ity, -ence, -ship)
- Count phrases and expressions that appear in the student text
- Return the total count of vocabulary items used correctly

**CLASS VOCABULARY IDENTIFICATION:**
- Find exact matches of vocabulary words/phrases from the class vocabulary list
- Include prefixes and suffixes as specified in vocabulary counting instructions
- Return an array of the actual vocabulary items found in the text (not just the count)
- Use the exact form found in the student text

**GRAMMAR STRUCTURE IDENTIFICATION:**
- Carefully identify which grammar structures from the class grammar list appear in the student text
- Look for the EXACT structures listed in the class profile (provided above)
- Match structure names exactly as they appear in the class list
- Be thorough and systematic - scan the entire text for each structure
- Common structures to look for include: Present Perfect, Past Simple, Conditionals, Passive Voice, Reported Speech, Relative Clauses, Modal Verbs, Future Forms, Comparative/Superlative, etc.
- Return an array of the specific structures found (use exact names from the class list)

**TRANSITION WORDS DETECTION:**
- Identify transition words and phrases used in the student text
- Look for common transitions like: however, therefore, moreover, furthermore, in addition, on the other hand, as a result, consequently, meanwhile, first, second, finally, in conclusion, etc.
- Return an array of the transition words/phrases actually found in the text
- Include both single words and phrases

## COMMON MISTAKES TO AVOID:
❌ Please do not highlight almost the entire essay. Some of these essays will be pretty bad, so if you encounter a horrible essay, just try to stick to the errors that will get the student on the right track.

STUDENT TEXT:
"""${studentText}"""
`.trim();
}