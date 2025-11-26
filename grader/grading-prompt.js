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

  return `You are an ESL writing grader. Score according to the rubric and provide brief feedback.

## TASK
Score each category using the rubric bands. Errors are already detected - use them to inform your scores.

CEFR Level: ${cefrLevel} (${levelInfo.name})
Word Count: ${errorDetectionResults.word_count || 'unknown'}
Total Errors: ${errorDetectionResults.inline_issues.length} (${errorSummary})
Vocabulary Used: ${errorDetectionResults.vocabulary_count || 0}
Grammar Structures: ${errorDetectionResults.grammar_structures_used?.join(', ') || 'none'}

## ZERO SCORE RULES (automatic 0):
${rubric.zero_rules.map(rule => `- ${rule}`).join('\n')}

## RUBRIC:
${categories.map(cat => {
  const category = rubric.categories[cat];
  return `**${category.name}** (${category.weight} pts):
${category.bands.map(band => `  ${band.range}: ${band.description}`).join('\n')}`;
}).join('\n\n')}

## ASSIGNMENT:
${classProfile.prompt || 'No specific prompt provided'}

Requirements:
- Transition words: ${rubric.layout_rules.transition_words_min} minimum
- Class vocabulary: ${classProfile.vocabulary.join(', ')}
- Grammar structures: ${classProfile.grammar.join(', ')}

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
