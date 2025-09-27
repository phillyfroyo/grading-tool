// grader/grading-prompt.js
// STEP 2: RUBRIC-BASED GRADING

export function buildGradingPrompt(rubric, classProfile, cefrLevel, studentText, errorDetectionResults) {
  const levelInfo = rubric.cefr_levels[cefrLevel] || rubric.cefr_levels['C1'];
  const categories = Object.keys(rubric.categories);

  return `You are an expert ESL writing grader. Grade according to the rubric.

## YOUR JOB
Assign accurate scores based on the rubric. Errors are already detected. Provide feedback according to the actual essay quality.

ERRORS PROVIDED: ${errorDetectionResults.inline_issues.length} total errors found
VOCABULARY COUNT: ${errorDetectionResults.vocabulary_count || 0}
GRAMMAR STRUCTURES: ${errorDetectionResults.grammar_structures_used?.join(', ') || 'none'}

## GRADING MINDSET
- Follow the rubric objectively
- Score based on demonstrated competency
- Provide accurate assessment

CEFR Level: ${cefrLevel} (${levelInfo.name})

## ZERO SCORE RULES (automatic 0 if any apply):
${rubric.zero_rules.map(rule => `- ${rule}`).join('\n')}

## GRADING CATEGORIES:
${categories.map(cat => {
  const category = rubric.categories[cat];
  return `${category.name} (${category.weight} points):
${category.bands.map(band => `  ${band.range}: ${band.description}`).join('\n')}`;
}).join('\n\n')}


## POINT VALUES (use these exact values):
- Grammar: out_of = 15
- Vocabulary: out_of = 15  
- Spelling: out_of = 10
- Mechanics: out_of = 15
- Fluency: out_of = 15
- Layout: out_of = 15
- Content: out_of = 15

## REQUIREMENTS:
- Word count: ${rubric.layout_rules.target_word_count_min}-${rubric.layout_rules.target_word_count_max}
- Transition words: ${rubric.layout_rules.transition_words_min} minimum
- Class vocabulary: ${classProfile.vocabulary.join(', ')}
- Grammar structures: ${classProfile.grammar.join(', ')}

## SCORING RULES:
- Follow rubric bands precisely
- Score based on actual performance against criteria
- Perfect performance = FULL POINTS
- Use the full range of the rubric


## STUDENT TEXT:
"${studentText}"

## DETECTED ERRORS:
${errorDetectionResults.inline_issues.map(issue => 
  `- ${issue.category || issue.type}: ${issue.explanation || issue.message || `${issue.text} → ${issue.correction}`}`
).join('\n')}

## TWO-PART APPROACH:
1. SCORING: Apply rubric bands objectively to determine points
2. FEEDBACK: Write constructive, helpful comments (see guidelines below)

## FEEDBACK WRITING GUIDELINES:
- Be accurate but constructive, not harsh or discouraging
- **Tailor feedback to ${cefrLevel} level expectations and capabilities**
- Focus on what needs improvement without being overly critical
- Don't reveal internal grading mechanics (specific word counts, exact error counts, score ranges)
- When performance is mixed, acknowledge both strengths and weaknesses
- Provide actionable advice **appropriate for ${cefrLevel} student level**
- Use 2nd person ("you") not 3rd person ("the student")
- **Remember: A1 students need different feedback than C1 students**

## FEEDBACK LANGUAGE EXAMPLES:

❌ BAD: "Many grammatical errors (15+ and basic ones) and no use of any structure seen in class"
✅ GOOD: "Focus on improving grammar structures and working on tense consistency"

❌ BAD: "Barely meets requirements. Length is 30 words under the target"
✅ GOOD: "Work on developing your ideas more fully to meet the assignment requirements"

❌ BAD: "No valid content points. Essay has nothing to do with the topic"
✅ GOOD: "Make sure to address the assignment topic and develop relevant ideas"

❌ BAD: "Frequent errors that obscure communication"
✅ GOOD: "Several errors affect clarity. Review basic spelling and grammar rules"

For higher scores, be encouraging:
✅ "Good use of grammar structures with minor errors to address"
✅ "Your vocabulary choices show effort - keep building on this foundation"

For lower scores, be constructive:
✅ "This needs significant improvement. Focus first on basic sentence structure"
✅ "Start by ensuring you address the assignment prompt fully"

## OUTPUT FORMAT:
{
  "scores": {
    "grammar": {"points": X, "out_of": 15, "rationale": "Constructive feedback on grammar performance"},
    "vocabulary": {"points": X, "out_of": 15, "rationale": "Helpful comments on vocabulary usage"},
    "spelling": {"points": X, "out_of": 10, "rationale": "Constructive spelling feedback"},
    "mechanics": {"points": X, "out_of": 15, "rationale": "Helpful feedback on punctuation and mechanics"},
    "fluency": {"points": X, "out_of": 15, "rationale": "Constructive comments on organization and flow"},
    "layout": {"points": X, "out_of": 15, "rationale": "Helpful feedback on structure and format"},
    "content": {"points": X, "out_of": 15, "rationale": "Constructive feedback on content and ideas"}
  },
  "total": {"points": X, "out_of": 100},
  "teacher_notes": "Overall constructive feedback that helps the student understand their performance and how to improve.",
  "encouragement_next_steps": [
    "Actionable steps for improvement",
    "Specific areas to focus on",
    "Helpful study suggestions"
  ]
}

Categories must be exactly: grammar, vocabulary, spelling, mechanics, fluency, layout, content
Return ONLY valid JSON - no explanations or markdown.`;
}