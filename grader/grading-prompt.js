// grader/grading-prompt.js
// STEP 2: RUBRIC-BASED GRADING

export function buildGradingPrompt(rubric, classProfile, cefrLevel, studentText, errorDetectionResults, studentNickname) {
  const levelInfo = rubric.cefr_levels[cefrLevel] || rubric.cefr_levels['C1'];
  const categories = Object.keys(rubric.categories);

  const studentName = studentNickname && studentNickname.trim() ? studentNickname.trim() : '';

  // Count errors by category and find the top categories
  const errorCounts = {};
  errorDetectionResults.inline_issues.forEach(issue => {
    const cat = issue.category || issue.type || 'unknown';
    errorCounts[cat] = (errorCounts[cat] || 0) + 1;
  });

  // Find the top 2 categories with the most errors (names only, no counts)
  const sortedErrors = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]);
  const topCategories = sortedErrors.slice(0, 2).map(([cat]) => cat).join(' and ');
  const hasMultipleIssues = sortedErrors.length > 1;

  return `You are an expert ESL writing grader. Grade according to the rubric.

## YOUR JOB
Assign accurate scores based on the rubric. Errors are already detected. Provide feedback according to the actual essay quality.

ERRORS PROVIDED: ${errorDetectionResults.inline_issues.length} total errors found
VOCABULARY COUNT: ${errorDetectionResults.vocabulary_count || 0}
GRAMMAR STRUCTURES: ${errorDetectionResults.grammar_structures_used?.join(', ') || 'none'}

## GRADING MINDSET
- Follow the rubric objectively while maintaining a supportive tone
- Score based on demonstrated competency with growth-oriented feedback
- Provide accurate assessment that celebrates things done correctly and guides improvement
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
- Spelling: out_of = 15
- Mechanics: out_of = 15
- Fluency: out_of = 10
- Layout: out_of = 15
- Content: out_of = 15

## ASSIGNMENT PROMPT:
${classProfile.prompt || 'No specific prompt provided'}

## REQUIREMENTS:
- Word count: **See assignment prompt above for specific word count requirement**
- Transition words: ${rubric.layout_rules.transition_words_min} minimum
${classProfile.vocabulary.length > 0 ? `- Class vocabulary to look for: ${classProfile.vocabulary.join(', ')}` : '- Class vocabulary: Not specified (grade vocabulary correctness only)'}
${classProfile.grammar.length > 0 ? `- Grammar structures to look for: ${classProfile.grammar.join(', ')}` : '- Grammar structures: Not specified (grade grammar correctness only)'}

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

## OUTPUT FORMAT:
{
  "scores": {
    "grammar": {"points": X, "out_of": 15, "rationale": "Brief note explaining score (1 sentence)"},
    "vocabulary": {"points": X, "out_of": 15, "rationale": "Brief note explaining score (1 sentence)"},
    "spelling": {"points": X, "out_of": 15, "rationale": "Brief note explaining score (1 sentence)"},
    "mechanics": {"points": X, "out_of": 15, "rationale": "Brief note explaining score (1 sentence)"},
    "fluency": {"points": X, "out_of": 10, "rationale": "Brief note explaining score (1 sentence)"},
    "layout": {"points": X, "out_of": 15, "rationale": "Brief note explaining score (1 sentence)"},
    "content": {"points": X, "out_of": 15, "rationale": "Brief note explaining score (1 sentence)"}
  },
  "total": {"points": X, "out_of": 100},
  "teacher_notes": "See format below",
  "encouragement_next_steps": ["Step 1", "Step 2", "Step 3"]
}

## RATIONALE FORMAT:
For each category rationale, write 1 brief sentence that:
- Explains why the student received this score
- References specific strengths or areas for improvement
- Uses supportive language (e.g., "Good use of transitions" or "Let's work on tense consistency")
- No exclamation marks

## TEACHER_NOTES FORMAT:
${studentName ? `Start with "${studentName} - " then follow the format below.` : 'Follow the format below.'}

Structure: [Intro] + [ONE sentence mentioning 1-2 areas to improve] + [Closing]

Pick ONE intro based on total score:
- 0-49: (skip intro, start with feedback)
- 50-59: "Not too bad overall."
- 60-69: "Good work here."
- 70-79: "I think you did a great job overall."
- 80-89: "Great job overall."
- 90-100: "Excellent work overall."

The areas that need the most attention: ${topCategories || 'none'}.
Write ONE sentence about ${hasMultipleIssues ? 'one or both of these areas' : 'this area'}.
Choose from phrases like:
- "Let's focus on [category] going forward."
- "Let's work on [categories], as these need the most attention."
- "Keep practicing [categories] - that's where we can improve most."
- "Next time, pay extra attention to [categories]."
NEVER include numbers or counts in the teacher notes.

CRITICAL RULES:
- Write exactly ONE feedback sentence - do NOT write two sentences that say the same thing differently
- No exclamation marks
- Always end with: "See detailed notes below the color-coded essay."

Return ONLY valid JSON.`;
}
