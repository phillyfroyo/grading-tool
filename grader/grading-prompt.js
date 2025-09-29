// grader/grading-prompt.js
// STEP 2: RUBRIC-BASED GRADING

export function buildGradingPrompt(rubric, classProfile, cefrLevel, studentText, errorDetectionResults, studentNickname) {
  const levelInfo = rubric.cefr_levels[cefrLevel] || rubric.cefr_levels['C1'];
  const categories = Object.keys(rubric.categories);

  // Determine student reference - use nickname if provided, otherwise use generic terms
  const studentRef = studentNickname && studentNickname.trim() ? studentNickname.trim() : 'the student';
  const studentRefCapitalized = studentNickname && studentNickname.trim() ?
    studentNickname.charAt(0).toUpperCase() + studentNickname.slice(1) : 'The student';

  // Debug logging
  console.log('🏷️ GRADING PROMPT: Student nickname received:', studentNickname || 'none');
  console.log('🏷️ GRADING PROMPT: Using student reference:', studentRef);

  return `You are an expert ESL writing grader. Grade according to the rubric.

## YOUR JOB
Assign accurate scores based on the rubric. Errors are already detected. Provide feedback according to the actual essay quality.

ERRORS PROVIDED: ${errorDetectionResults.inline_issues.length} total errors found
VOCABULARY COUNT: ${errorDetectionResults.vocabulary_count || 0}
GRAMMAR STRUCTURES: ${errorDetectionResults.grammar_structures_used?.join(', ') || 'none'}

## GRADING MINDSET
- Follow the rubric objectively while maintaining a supportive tone
- Score based on demonstrated competency with growth-oriented feedback
- Provide accurate assessment that celebrates progress and guides improvement
- Focus on student effort and potential, not just current deficiencies

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
  `- ${issue.category || issue.type}: ${issue.text} → ${issue.correction}`
).join('\n')}

## TWO-PART APPROACH:
1. SCORING: Apply rubric bands objectively to determine points
2. FEEDBACK: Write encouraging, positive, and growth-oriented comments that celebrate effort and guide improvement (see positive guidelines above)

## IMPORTANT NOTES:
- **LEAVE ALL rationale FIELDS BLANK** (empty string "")
- Category feedback is optional and should be added manually by teachers
- Only provide overall teacher_notes for general essay feedback
- Score objectively based on rubric but don't include category-specific comments

## POSITIVE FEEDBACK LANGUAGE GUIDELINES:

**ALWAYS START POSITIVELY:** Begin with encouragement and acknowledge effort
**BE GROWTH-ORIENTED:** Frame challenges as opportunities for improvement
**BALANCE FEEDBACK:** Include what the student did well alongside areas to strengthen
**USE SUPPORTIVE LANGUAGE:** "Let's work on" instead of "You need to fix"

${studentNickname && studentNickname.trim() ? `
**PERSONALIZED POSITIVE FEEDBACK** (using student nickname "${studentNickname}"):

❌ HARSH: "Many grammatical errors (15+ and basic ones) and no use of any structure seen in class"
✅ POSITIVE: "${studentNickname} - Nice work overall. Let's focus on strengthening your grammar structures and tense consistency."

❌ HARSH: "Barely meets requirements. Length is 30 words under the target"
✅ POSITIVE: "${studentRefCapitalized} - good ideas here. Try developing them more fully to meet the length requirements."

❌ HARSH: "No valid content points. Essay has nothing to do with the topic"
✅ POSITIVE: "${studentRefCapitalized} - let's focus on addressing the assignment topic more directly."

❌ HARSH: "Frequent errors that obscure communication"
✅ POSITIVE: "${studentRefCapitalized} - let's work on grammar and spelling to make your message clearer."

**For higher scores, celebrate and guide:**
✅ "${studentNickname} - Good work. Just a few areas to fine-tune."
✅ "${studentNickname} - Your vocabulary shows progress. Keep building on this."

**For lower scores, encourage and support:**
✅ "${studentRefCapitalized} - let's work on basic sentence structure."
✅ "${studentRefCapitalized} - focus on addressing the assignment prompt more fully."` : `

❌ HARSH: "Many grammatical errors (15+ and basic ones) and no use of any structure seen in class"
✅ POSITIVE: "Nice work overall. Let's focus on strengthening your grammar structures and tense consistency."

❌ HARSH: "Barely meets requirements. Length is 30 words under the target"
✅ POSITIVE: "Good ideas here. Try developing them more fully to meet the length requirements."

❌ HARSH: "No valid content points. Essay has nothing to do with the topic"
✅ POSITIVE: "Let's focus on addressing the assignment topic more directly."

❌ HARSH: "Frequent errors that obscure communication"
✅ POSITIVE: "Let's work on grammar and spelling to make your message clearer."

**For higher scores, celebrate and guide:**
✅ "Good work. Just a few areas to fine-tune."
✅ "Your vocabulary shows progress. Keep building on this."

**For lower scores, encourage and support:**
✅ "Let's work on basic sentence structure."
✅ "Focus on addressing the assignment prompt more fully."`}

## OUTPUT FORMAT:
{
  "scores": {
    "grammar": {"points": X, "out_of": 15, "rationale": ""},
    "vocabulary": {"points": X, "out_of": 15, "rationale": ""},
    "spelling": {"points": X, "out_of": 10, "rationale": ""},
    "mechanics": {"points": X, "out_of": 15, "rationale": ""},
    "fluency": {"points": X, "out_of": 15, "rationale": ""},
    "layout": {"points": X, "out_of": 15, "rationale": ""},
    "content": {"points": X, "out_of": 15, "rationale": ""}
  },
  "total": {"points": X, "out_of": 100},
  "teacher_notes": "${studentNickname && studentNickname.trim() ?
    'MUST START WITH: ' + studentNickname + ' - [then one of the sentence starters below based on score]. ' +
    'NEVER use exclamation marks. BE CONCISE - 1-2 sentences maximum. ' +
    'MUST END WITH: See detailed notes below the color-coded essay. ' +
    'REQUIRED FORMAT based on total score: ' +
    'Below 50: ' + studentNickname + ' - Not horrible, but it needs improvement. [specific feedback] See detailed notes below the color-coded essay. ' +
    '50-59: ' + studentNickname + ' - Not too bad overall. [specific feedback] See detailed notes below the color-coded essay. ' +
    '60-69: ' + studentNickname + ' - I think you did a good job overall. [specific feedback] See detailed notes below the color-coded essay. ' +
    '70-79: ' + studentNickname + ' - I think you did a great job overall. [specific feedback] See detailed notes below the color-coded essay. OR ' + studentNickname + ' - Solid work with this essay. [specific feedback] See detailed notes below the color-coded essay. ' +
    '80-89: ' + studentNickname + ' - Great job overall. [specific feedback] See detailed notes below the color-coded essay. OR ' + studentNickname + ' - Nice work overall. [specific feedback] See detailed notes below the color-coded essay. ' +
    '90+: ' + studentNickname + ' - Excellent work overall. [specific feedback] See detailed notes below the color-coded essay. OR ' + studentNickname + ' - Outstanding job. [specific feedback] See detailed notes below the color-coded essay. ' +
    'The [specific feedback] should use phrases like Let us work on for areas to improve. Do not over-praise basic assignment compliance. ALWAYS end with: See detailed notes below the color-coded essay.' :
    'NEVER use exclamation marks. BE CONCISE - 1-2 sentences maximum. ' +
    'MUST END WITH: See detailed notes below the color-coded essay. ' +
    'REQUIRED SENTENCE STARTERS (choose based on total score): ' +
    'Below 50 points: Not horrible, but it needs improvement. ' +
    '50-59 points: Not too bad overall. ' +
    '60-69 points: I think you did a good job overall. ' +
    '70-79 points: I think you did a great job overall. OR Solid work with this essay. ' +
    '80-89 points: Great job overall. OR Nice work overall. ' +
    '90+ points: Excellent work overall. OR Outstanding job. ' +
    'After the starter, add specific feedback using phrases like Let us work on for areas to improve. Do not over-praise basic assignment compliance. ALWAYS end with: See detailed notes below the color-coded essay.'}",
  "encouragement_next_steps": [
    "Actionable steps for improvement",
    "Specific areas to focus on",
    "Helpful study suggestions"
  ]
}

Categories must be exactly: grammar, vocabulary, spelling, mechanics, fluency, layout, content
Return ONLY valid JSON - no explanations or markdown.`;
}