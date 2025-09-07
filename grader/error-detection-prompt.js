// grader/error-detection-prompt.js
// STEP 1: AGGRESSIVE ERROR DETECTION (color-coded essay markings)

export function buildErrorDetectionPrompt(classProfile, studentText) {
  return `
Please grade the below essay and identify specific errors. You are good at analyzing natural language. Use this to your advantage. Find all mistakes.

Mark the essay using these categories:

CATEGORIES:
- grammar (tense, agreement, articles, word order, modal/auxiliary use)
- mechanics-punctuation (capitalization, commas, periods, run-ons)  
- spelling (misspellings)
- vocabulary-structure (word choice, collocations)
- needs-rephrasing (unclear sentence that needs restructuring)
- redundancy
- non-suitable-words (words that should be removed)
- fluency (naturalness coaching)
- professor-comments (rare; general note with a span)

Look at the whole essay in context. Be extremely thorough and precise. Find all mistakes, even if it's a phrase that sounds awkward. Don't confuse this with providing markings for the sake of providing markings, however. If there are no mistakes, don't provide any markings.

EXAMPLE OF EXCELLENT ERROR DETECTION:

STUDENT TEXT: "Hello friend! I feel too happy to can talk with you and I can say all of my advices and tips that I have been use in my whole business life, today I would like introduce you to the entrepreneurship. This is a good way to put in practice your creativity and passions to generate PROVIDES and use the MONEY to pay whatever you want. The significance of innovation in entrepreneurship is create an a new BUSSINES PLAN or products that people follows and spend on this, because that is very wonderful and essential to these new generations. For example, one of my favourites entrepreneurs is Mark Zukenberg: his BRAND on the NETWORKING was a completely an innovation in that age, cause Facebook had things like profiles of friends. can do post of whathever mind, likes and comments on the post and photos, althouprivate chats with someone, etc. And the people felt good (serotonin) with all of the new communication. You can start with a little business, think on a unique brand or a VALUE PROPOSITION, put your plan in action and dont forget why you want do it! like (If you work hard you will have success in your life), (If you take care with your money, you wont an a BAKRUPT), (If you have an ACCOUNT bank, you will have an order in the money), (If you dont take care with your money, you will DEBT to others) or (If you have LOYALTY with others , They will have good thing for you too). Good Luck, and you got this, love you!"

CORRECT ERRORS TO IDENTIFY:
- "I feel too happy" → "I feel so happy" (grammar)
- "to can talk" → "to be able to talk" (grammar - modal usage)
- "advices" → "advice" (vocabulary-structure - uncountable noun)
- "I have been use" → "I have been using" (grammar - verb form)
- "I would like introduce you" → "I would like to introduce you" (grammar - missing infinitive "to")
- "generate PROVIDES" → "generate income/profit" (vocabulary-structure - wrong word choice)
- "is create an a new BUSSINES PLAN" → "is to create a new business plan" (grammar - infinitive structure)
- "BUSSINES" → "BUSINESS" (spelling)
- "people follows" → "people follow" (grammar - subject-verb agreement)
- "favourites entrepreneurs" → "favorite entrepreneurs" (spelling - American English)
- "Zukenberg" → "Zuckerberg" (spelling)
- "was a completely an innovation" → "was completely an innovation" (grammar - article usage)
- "whathever" → "whatever" (spelling)
- "althouprivate" → "although private" (spelling)
- "dont" → "don't" (mechanics-punctuation - apostrophe)
- "why you want do it" → "why you want to do it" (grammar - missing infinitive "to")
- "you wont an a BAKRUPT" → "you won't go bankrupt" (grammar - multiple errors)
- "BAKRUPT" → "bankrupt" (spelling)
- "an ACCOUNT bank" → "a bank account" (grammar - word order)
- "you will DEBT to others" → "you will be in debt to others" (grammar - verb structure)
- "good thing" → "good things" (grammar - plurality)

Follow this pattern of thoroughness and accuracy.

CLASS VOCABULARY TO COUNT (${classProfile.vocabulary.length} items):
${classProfile.vocabulary.join(', ')}

GRAMMAR STRUCTURES TO IDENTIFY:
${classProfile.grammar.join(', ')}

Count how many class vocabulary items are used correctly and identify which grammar structures from class appear in the text.

Return your analysis in this JSON format:
{
  "inline_issues": [
    {
      "type": "grammar",
      "subtype": "modal_usage", 
      "message": "'to can talk' → 'to be able to talk'",
      "offsets": {"start": 15, "end": 21},
      "quote": "to can talk"
    }
  ],
  "corrected_text_minimal": "Fix only objective errors; keep meaning and order.",
  "vocabulary_count": 5,
  "grammar_structures_used": ["Present Perfect for experience", "Conditionals (2nd and 3rd)"],
  "input_is_assignment_prompt": false
}

REQUIREMENTS
- Every issue must include: type, message, offsets, and exact "quote" = studentText.slice(start,end).
- For insertions (no characters selected), set start==end and "quote": "".
- Offsets must be valid indices in the provided text.

STUDENT TEXT:
"""${studentText}"""
`.trim();
}
