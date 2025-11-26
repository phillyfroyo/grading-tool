// grader/grading-prompt.js
// STEP 2: RUBRIC-BASED GRADING

export function buildGradingPrompt(rubric, classProfile, cefrLevel, studentText, errorDetectionResults, studentNickname) {
  const levelInfo = rubric.cefr_levels[cefrLevel] || rubric.cefr_levels['C1'];
  const categories = Object.keys(rubric.categories);

  const studentName = studentNickname && studentNickname.trim() ? studentNickname.trim() : '';

  // Count errors by category for the prompt
  const errorCounts = {};
  errorDetectionResults.inline_issues.forEach(issue => {
    const cat = issue.category || issue.type || 'unknown';
    errorCounts[cat] = (errorCounts[cat] || 0) + 1;
  });
  const errorSummary = Object.entries(errorCounts)
    .map(([cat, count]) => `${cat}: ${count}`)
    .join(', ') || 'none';

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
    "grammar": {"points": X, "out_of": 15, "rationale": ""},
    "vocabulary": {"points": X, "out_of": 15, "rationale": ""},
    "spelling": {"points": X, "out_of": 15, "rationale": ""},
    "mechanics": {"points": X, "out_of": 15, "rationale": ""},
    "fluency": {"points": X, "out_of": 10, "rationale": ""},
    "layout": {"points": X, "out_of": 15, "rationale": ""},
    "content": {"points": X, "out_of": 15, "rationale": ""}
  },
  "total": {"points": X, "out_of": 100},
  "teacher_notes": "See format below",
  "encouragement_next_steps": ["Step 1", "Step 2", "Step 3"]
}

## TEACHER_NOTES FORMAT:
${studentName ? `Start with "${studentName} - " then follow the format below.` : 'Follow the format below.'}

Structure: [Intro based on score] + [Natural feedback about main issues] + "See detailed notes below the color-coded essay."

Pick ONE intro based on total score:
- 0-49: (skip intro, start with feedback)
- 50-59: "Not too bad overall." OR "Solid effort, but there is room to grow."
- 60-69: "Good work here." OR "This is solid work."
- 70-79: "I think you did a great job overall." OR "Strong effort here."
- 80-89: "Great job overall." OR "Nice work overall."
- 90-100: "Excellent work overall." OR "Outstanding job."

Then write natural feedback (1 sentence) about the main area to improve. Focus on the category with the most errors (${errorSummary}). Use phrases like "Lets work on strengthening your grammar" or "Focus on spelling and mechanics going forward" - make it sound natural, not robotic.

RULES:
- No exclamation marks
- 2-3 sentences total (intro + feedback + closing)
- Base feedback on ACTUAL errors found, not generic advice
- Do NOT comment on word count or other statistics - only mention error categories
- Always end with: "See detailed notes below the color-coded essay."
- Leave all "rationale" fields as empty strings ""

Return ONLY valid JSON.`;
}
