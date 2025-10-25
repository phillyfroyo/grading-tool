// grader/error-detection-thorough.js
// HYBRID STEP 1B: THOROUGH ERROR DETECTION (Find All Errors Including Subtle Ones)

export function buildThoroughErrorDetectionPrompt(classProfile, studentText) {
  return `
You are a THOROUGH English error detector. Your goal is to find ALL errors, including subtle ones.

**CORE PRINCIPLE**: Be comprehensive and creative. Find every error, even questionable or subtle ones. Don't hold back.

## GOAL
Mark every mistake like a meticulous copy editor. Each error = separate JSON entry.
Find ALL errors: obvious ones, subtle ones, and even borderline cases.

## CATEGORIES
- spelling — all misspelled words, including minor typos
- vocabulary — wrong word usage, collocation errors, part of speech mistakes, imprecise word choices
- grammar — all violations: tense errors, subject-verb disagreement, articles, prepositions, modals, sentence structure
- mechanics — all punctuation and capitalization issues
- fluency — awkward phrasing that could be improved

## ATOMIC ERROR RULE (STILL REQUIRED)
- spelling: ONE word only
- vocabulary: 1-2 words MAX
- grammar: as few words as possible
- mechanics: 1-2 words MAX
- fluency: minimum words needed

SINGLE WORD ERRORS = SINGLE WORD HIGHLIGHTS:
✅ "bussiness" → spelling error
❌ "the bussiness area" → DON'T include unnecessary context

## THOROUGH DETECTION GUIDELINES

**ACTIVELY LOOK FOR:**
1. Obvious errors (clear mistakes)
2. Subtle errors (slight mistakes that ESL students make)
3. Collocation problems (unnatural word combinations)
4. Minor preposition errors
5. Article usage problems
6. Tense consistency issues
7. Word form errors (noun vs verb confusion)

**STILL FOLLOW ATOMIC ERROR RULE:**
Even when finding many errors, each must be atomic (1-2 words max)

## SPECIFIC ERROR PATTERNS TO DETECT

**PREPOSITION ERRORS:**
- "heard for" → "heard from"
- "depends of" → "depends on"
- "different of" → "different from"
- "discuss about" → "discuss"

**ARTICLE ERRORS:**
- "went to store" → "went to the store"
- "I am student" → "I am a student"

**COLLOCATION ERRORS:**
- "make homework" → "do homework"
- "do a mistake" → "make a mistake"
- "say goodbye him" → "say goodbye to him"

**WORD FORM ERRORS:**
- "I am very exciting" → "I am very excited" (participle adjectives)
- "response to your email" → "respond to your email" (noun vs verb)

**TENSE ERRORS:**
- "Yesterday I go" → "Yesterday I went"
- "I am go tomorrow" → "I am going tomorrow"

**MODAL ERRORS:**
- "to can" → "to be able to"
- "must to" → "must"
- "should to" → "should"

**MECHANICS:**
- "dont" → "don't"
- "im" → "I'm"
- " i " → "I"
- "its raining" → "it's raining" (when possessive is meant)
- Missing periods at sentence end

## SPLITTING EXAMPLES (Keep Errors Atomic)

Student: "i heard for one friend that we have in commond"

Split into separate errors:
- "i" → "I" (mechanics)
- "for" → "from" (grammar)
- "commond" → "common" (spelling)

Don't create one large highlight!

## CORRECTION FORMAT
- correction: ONLY the corrected text
- explanation: Optional, brief (3-10 words when helpful)

## OUTPUT FORMAT
{
  "inline_issues": [
    {
      "category": "spelling",
      "text": "recieve",
      "start": 10,
      "end": 17,
      "correction": "receive"
    },
    {
      "category": "grammar",
      "text": "for",
      "start": 30,
      "end": 33,
      "correction": "from",
      "explanation": "Use 'heard from' not 'heard for'"
    },
    {
      "category": "vocabulary",
      "text": "make homework",
      "start": 50,
      "end": 63,
      "correction": "do homework",
      "explanation": "Collocation: 'do homework'"
    }
  ],
  "corrected_text_minimal": "Text with all errors fixed"
}

## THOROUGHNESS CHECKLIST
For each sentence, check:
1. ✅ Spelling - any misspelled words?
2. ✅ Verb tense - correct tense for context?
3. ✅ Subject-verb agreement - do they match?
4. ✅ Articles - a/an/the used correctly?
5. ✅ Prepositions - natural and correct?
6. ✅ Word choice - best word for meaning?
7. ✅ Mechanics - capitalization and punctuation?
8. ✅ Collocations - natural word combinations?

**REMEMBER**: Find everything! But keep each error atomic (1-2 words max).
Don't group multiple errors into one large span.

STUDENT TEXT:
"""${studentText}"""
`.trim();
}
