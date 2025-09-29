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
✅ POSITIVE: "Nice work on your essay, ${studentNickname}! I can see you're putting effort into expressing your ideas. To help you improve even more, let's focus on strengthening your grammar structures and working on tense consistency."

❌ HARSH: "Barely meets requirements. Length is 30 words under the target"
✅ POSITIVE: "${studentRefCapitalized}, you have some good ideas here! To make your essay even stronger, try developing these ideas more fully to meet the assignment requirements. I'd love to see more of your thinking."

❌ HARSH: "No valid content points. Essay has nothing to do with the topic"
✅ POSITIVE: "${studentRefCapitalized}, you're working hard on your writing! Let's make sure your excellent effort is focused on addressing the assignment topic directly. I know you have great ideas to share about this subject."

❌ HARSH: "Frequent errors that obscure communication"
✅ POSITIVE: "${studentRefCapitalized}, I can see you're working to communicate your ideas! Let's polish up some grammar and spelling to help your message shine through even clearer."

**For higher scores, celebrate and guide:**
✅ "Excellent work, ${studentNickname}! Your grammar structures are really coming along nicely. Just a few small areas to fine-tune and you'll be even stronger."
✅ "Great job, ${studentNickname}! Your vocabulary choices show real progress. Keep building on this strong foundation - you're doing so well!"

**For lower scores, encourage and support:**
✅ "${studentRefCapitalized}, I can see you're trying hard, and that effort matters! Let's start by working together on basic sentence structure - you've got this!"
✅ "${studentRefCapitalized}, you have important things to say! Let's make sure we address the assignment prompt fully so your voice can really be heard."` : `

❌ HARSH: "Many grammatical errors (15+ and basic ones) and no use of any structure seen in class"
✅ POSITIVE: "Nice work on your essay! I can see you're putting effort into expressing your ideas. To help you improve even more, let's focus on strengthening your grammar structures and working on tense consistency."

❌ HARSH: "Barely meets requirements. Length is 30 words under the target"
✅ POSITIVE: "You have some good ideas here! To make your essay even stronger, try developing these ideas more fully to meet the assignment requirements. I'd love to see more of your thinking."

❌ HARSH: "No valid content points. Essay has nothing to do with the topic"
✅ POSITIVE: "You're working hard on your writing! Let's make sure your excellent effort is focused on addressing the assignment topic directly. I know you have great ideas to share about this subject."

❌ HARSH: "Frequent errors that obscure communication"
✅ POSITIVE: "I can see you're working to communicate your ideas! Let's polish up some grammar and spelling to help your message shine through even clearer."

**For higher scores, celebrate and guide:**
✅ "Excellent work! Your grammar structures are really coming along nicely. Just a few small areas to fine-tune and you'll be even stronger."
✅ "Great job! Your vocabulary choices show real progress. Keep building on this strong foundation - you're doing so well!"

**For lower scores, encourage and support:**
✅ "I can see you're trying hard, and that effort matters! Let's start by working together on basic sentence structure - you've got this!"
✅ "You have important things to say! Let's make sure we address the assignment prompt fully so your voice can really be heard."`}

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
  "teacher_notes": "${studentNickname && studentNickname.trim() ? `ALWAYS start with something positive and encouraging. Acknowledge ${studentRef}'s effort and hard work. Then provide supportive, growth-oriented feedback that helps ${studentRef} see next steps for improvement. Use encouraging language like 'Let's work on' instead of 'You need to fix.' Make it personal and warm using ${studentRef}'s nickname "${studentNickname}" when appropriate. End with confidence in ${studentRef}'s ability to improve and grow.` : 'ALWAYS start with something positive and encouraging. Acknowledge the student\'s effort and hard work. Then provide supportive, growth-oriented feedback that helps the student see next steps for improvement. Use encouraging language like "Let\'s work on" instead of "You need to fix." End with confidence in the student\'s ability to improve and grow.'}",
  "encouragement_next_steps": [
    "Actionable steps for improvement",
    "Specific areas to focus on",
    "Helpful study suggestions"
  ]
}

Categories must be exactly: grammar, vocabulary, spelling, mechanics, fluency, layout, content
Return ONLY valid JSON - no explanations or markdown.`;
}