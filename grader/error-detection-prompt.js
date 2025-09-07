// grader/error-detection-prompt.js
// STEP 1: SMART LANGUAGE-FOCUSED ERROR DETECTION

export function buildErrorDetectionPrompt(classProfile, studentText) {
  return `
You are an expert ESL writing grader. Your task is to analyze the student's essay and return detailed feedback.

## GOAL
You are a precision error detection tool. Your job is to identify **individual, specific errors** - NOT to fix sentences.

**THINK LIKE A COPY EDITOR:** Circle each mistake individually, don't rewrite sentences.

**WRONG APPROACH:** "I feel too happy to can talk" → Fix whole phrase as grammar
**CORRECT APPROACH:** 
- "too" (wrong word) → "so" 
- "to can" (modal error) → "to be able to"

---

## CATEGORIES
- spelling — misspelled words
- vocabulary-structure — wrong word, collocation, or part of speech
- grammar — tense, agreement, articles, prepositions, modals, sentence structure
- mechanics-punctuation — capitalization, commas, periods, run-ons, missing apostrophes
- needs-rephrasing — sentence is unclear and must be rewritten to understand
- redundancy — repeated or unnecessary words
- non-suitable-words — inappropriate tone or content for the context
- fluency — naturalness coaching for awkward but technically correct language
- professor-comments — rare, general note tied to a span

---

## HOW TO MARK ISSUES
⚠️ **CRITICAL RULE: NO LONG SPANS** ⚠️
- **Maximum 10 words per issue** - if longer, you MUST split it up
- Each **distinct mistake** must be a **separate issue** in the JSON output
- **NEVER mark entire sentences or paragraphs** as one error

**ATOMIC ERROR EXAMPLES:**

❌ **WRONG WAY (sentence-level fixes):**
- "I feel too happy to can talk with you" → grammar (fix whole phrase)
- "all of my advices and tips that I have been use" → grammar (fix whole phrase)

✅ **RIGHT WAY (individual errors):**
- "too" → vocabulary-structure (wrong word: "too" → "so")  
- "to can" → grammar (modal error: "to can" → "to be able to")
- "advices" → vocabulary-structure (uncountable: "advices" → "advice")
- "have been use" → grammar (verb form: "have been use" → "have been using")

❌ **NEVER DO THIS:**
- Mark "is create an a new BUSSINES PLAN" as one grammar error
✅ **DO THIS INSTEAD:**
- "is create" → grammar ("is create" → "is to create") 
- "an a" → grammar (double article: "an a" → "a")
- "BUSSINES" → spelling ("BUSSINES" → "BUSINESS")

**SPLITTING RULES:**
- **Do not label a mixed-error span as mechanics only**; split into spelling/vocabulary/grammar plus any punctuation
- **Split long sentences** into individual word/phrase errors
- **One error type per issue** - don't mix grammar + spelling in same span
- **Offsets are zero-based; end is exclusive** (e.g., "hello" at position 0-5)
- **Default to American English** unless the essay is consistently another variety
- Always include:
  - \`category\` (error type from the categories list)
  - \`text\` (exact text that has the error)
  - \`start\` and \`end\` (character positions in the original text)
  - \`correction\` (what it should be)
  - \`explanation\` (brief reason for the correction)
  - \`coaching_only: true\` when \`category: "fluency"\` (these are suggestions, not errors)

---

## OUTPUT JSON FORMAT
You must return JSON like this (notice how each error is ATOMIC):
\`\`\`json
{
  "inline_issues": [
    {
      "category": "vocabulary-structure",
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
      "explanation": "Modal 'can' cannot follow 'to' - use infinitive form"
    },
    {
      "category": "vocabulary-structure",
      "text": "advices",
      "start": 89,
      "end": 96,
      "correction": "advice", 
      "explanation": "'Advice' is uncountable - no plural form"
    }
  ],
  "corrected_text_minimal": "Return the text with only objective errors fixed. Keep meaning and order.",
  "vocabulary_count": 5,
  "grammar_structures_used": ["Present Perfect", "Second Conditional"],
  "input_is_assignment_prompt": false
}
\`\`\`

---

## VOCABULARY & GRAMMAR TRACKING
CLASS VOCABULARY WORDS (${classProfile.vocabulary.length} total):
${classProfile.vocabulary.join(', ')}

GRAMMAR STRUCTURES TO LOOK FOR:
${classProfile.grammar.join(', ')}

- Count how many vocabulary words are used **correctly**.
- Identify which grammar structures from the class appear in the student's text.

---

## APPROACH - ATOMIC ERROR DETECTION
1. **Read word by word** - examine each word for errors.
2. **For each error you find, ask:** "What is the SMALLEST unit I can mark that contains just this one mistake?"
3. **STOP when you've identified the specific error** - don't keep expanding to "fix the sentence."
4. **Multiple errors in one sentence = multiple separate issues.**
5. **Test yourself:** If your marked span contains 2+ different error types, you're doing it wrong.

**MINDSET SHIFT:**
- OLD: "Fix this sentence to make it sound better"
- NEW: "Circle each individual mistake like a teacher with a red pen"

**BEFORE MARKING EACH ERROR, ASK:**
- "Is this the smallest possible span that captures this specific error?"
- "Does this span contain only ONE type of error?"
- "Would a student understand exactly what ONE thing is wrong?"

---

STUDENT TEXT:
"""${studentText}"""
`.trim();
}
