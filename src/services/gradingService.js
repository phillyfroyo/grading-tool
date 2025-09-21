// Grading service
// Contains the unified grading logic for both local and Vercel environments

import { gradeEssay } from "../../grader/grader-two-step.js";

/**
 * Unified grading function that works identically in local and Vercel environments
 * @param {string} studentText - The student's essay text
 * @param {string} prompt - The assignment prompt
 * @param {Object} profileData - The class profile data
 * @returns {Promise<Object>} Grading results
 */
async function gradeEssayUnified(studentText, prompt, profileData) {
  console.log('=== STARTING UNIFIED TWO-STEP GRADING ===');
  console.log('Profile:', profileData.name);
  console.log('Student text length:', studentText?.length);

  try {
    // Import OpenAI dynamically for serverless compatibility
    const OpenAI = (await import("openai")).default;

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Embedded rubric data (from rubric.json) - no file dependencies!
    const rubric = {
      "categories": {
        "grammar": {
          "id": "grammar",
          "name": "Grammar",
          "color": "#FF6B6B",
          "backgroundColor": "#FFE5E5",
          "weight": 15
        },
        "vocabulary": {
          "id": "vocabulary",
          "name": "Vocabulary",
          "color": "#4ECDC4",
          "backgroundColor": "#E8F8F7",
          "weight": 15
        },
        "spelling": {
          "id": "spelling",
          "name": "Spelling",
          "color": "#45B7D1",
          "backgroundColor": "#E3F2FD",
          "weight": 10
        },
        "mechanics": {
          "id": "mechanics",
          "name": "Mechanics & Punctuation",
          "color": "#F7B731",
          "backgroundColor": "#FFF8E1",
          "weight": 15
        },
        "fluency": {
          "id": "fluency",
          "name": "Fluency",
          "color": "#A855F7",
          "backgroundColor": "#F3E8FF",
          "weight": 15
        },
        "layout": {
          "id": "layout",
          "name": "Layout & Follow Specs",
          "color": "#16A34A",
          "backgroundColor": "#DCFCE7",
          "weight": 15
        },
        "content": {
          "id": "content",
          "name": "Content & Information",
          "color": "#DC2626",
          "backgroundColor": "#FEE2E2",
          "weight": 15
        }
      }
    };

    console.log('🔍 STEP 1: Error Detection & Highlighting...');

    // STEP 1: Error Detection with color-coded highlighting
    const errorDetectionPrompt = `Please grade the below essay and identify specific errors. You are good at analyzing natural language.

Mark the essay using these categories:
- grammar (tense, agreement, articles, word order, modal/auxiliary use)
- mechanics-punctuation (capitalization, commas, periods, run-ons)
- spelling (misspellings)
- vocabulary-structure (word choice, collocations)
- needs-rephrasing (unclear sentence that needs restructuring)
- redundancy
- non-suitable-words (words that should be removed)
- fluency (naturalness coaching)

Class Profile: ${profileData.name}
Expected Vocabulary: ${profileData.vocabulary.slice(0, 10).join(', ')}
Expected Grammar: ${profileData.grammar.slice(0, 5).join(', ')}

Student Essay:
${studentText}

For each error found, return this JSON format:
{
  "errors": [
    {
      "category": "grammar|mechanics-punctuation|spelling|vocabulary-structure|needs-rephrasing|redundancy|non-suitable-words|fluency",
      "text": "exact text from essay with error",
      "correction": "suggested correction",
      "explanation": "brief explanation of the error"
    }
  ]
}

Return ONLY valid JSON.`;

    const errorResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: errorDetectionPrompt }],
      temperature: 0.3,
      max_tokens: 2000
    });

    let errorResults = { errors: [] };
    try {
      const errorText = errorResponse.choices[0].message.content;
      const cleanedErrorText = errorText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      errorResults = JSON.parse(cleanedErrorText);
    } catch (e) {
      console.warn('Error parsing error detection:', e.message);
    }

    console.log('🔍 Found', errorResults.errors?.length || 0, 'errors');
    console.log('📊 STEP 2: Comprehensive Grading...');

    // STEP 2: Comprehensive grading based on rubric
    const gradingPrompt = `You are an ESL teacher grading a ${profileData.cefrLevel}-level student essay using a detailed rubric.

Class Profile: ${profileData.name}
Expected Vocabulary: ${profileData.vocabulary.join(', ')}
Expected Grammar: ${profileData.grammar.join(', ')}

Assignment Prompt: ${prompt}

Student Essay:
${studentText}

Errors Found: ${JSON.stringify(errorResults.errors || [])}

Grade this essay using the following rubric (total 100 points):
- Grammar (15 points): Tenses, subject/verb agreement, structures from class
- Vocabulary (15 points): Correct use of class vocabulary
- Spelling (10 points): Accuracy of spelling
- Mechanics & Punctuation (15 points): Capitalization, commas, periods
- Fluency (15 points): Organization and logical flow
- Layout & Specs (15 points): Structure, length, transition words
- Content & Information (15 points): Completeness and relevance of ideas

For each category, provide points earned and brief rationale.
Also identify:
- Word count
- Class vocabulary words used
- Grammar structures demonstrated
- Transition words found

Return ONLY this JSON format:
{
  "total": {"points": [total], "out_of": 100},
  "scores": {
    "grammar": {"points": [0-15], "out_of": 15, "rationale": "..."},
    "vocabulary": {"points": [0-15], "out_of": 15, "rationale": "..."},
    "spelling": {"points": [0-10], "out_of": 10, "rationale": "..."},
    "mechanics": {"points": [0-15], "out_of": 15, "rationale": "..."},
    "fluency": {"points": [0-15], "out_of": 15, "rationale": "..."},
    "layout": {"points": [0-15], "out_of": 15, "rationale": "..."},
    "content": {"points": [0-15], "out_of": 15, "rationale": "..."}
  },
  "teacher_notes": "Overall feedback...",
  "meta": {
    "word_count": [number],
    "class_vocabulary_used": ["word1", "word2"],
    "transition_words_found": ["however", "therefore"],
    "grammar_structures_used": ["structure1", "structure2"]
  }
}`;

    const gradingResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: gradingPrompt }],
      temperature: 0.3,
      max_tokens: 2000
    });

    const gradingText = gradingResponse.choices[0].message.content;
    console.log('=== RAW GRADING RESPONSE ===');
    console.log(gradingText);
    console.log('=== END RAW GRADING RESPONSE ===');

    const cleanedGrading = gradingText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    console.log('=== CLEANED GRADING JSON ===');
    console.log(cleanedGrading);
    console.log('=== END CLEANED JSON ===');

    let gradingResult;
    try {
      gradingResult = JSON.parse(cleanedGrading);
    } catch (error) {
      console.error('JSON parsing failed:', error.message);
      console.error('Invalid JSON at character position:', error.message.match(/position (\d+)/)?.[1]);
      throw error;
    }

    // Calculate total points correctly
    const totalPoints = Object.values(gradingResult.scores).reduce((sum, score) => sum + score.points, 0);
    gradingResult.total = { points: totalPoints, out_of: 100 };

    // Convert errors to inline_issues format for the formatter
    gradingResult.inline_issues = (errorResults.errors || []).map(error => ({
      category: error.category,
      text: error.text,
      start: studentText.indexOf(error.text),
      end: studentText.indexOf(error.text) + error.text.length,
      correction: error.correction,
      explanation: error.explanation
    })).filter(issue => issue.start !== -1); // Only include found text

    gradingResult.rubric = rubric;
    gradingResult.encouragement_next_steps = gradingResult.teacher_notes;

    console.log('✅ UNIFIED GRADING COMPLETED:', gradingResult.total);
    console.log('🎨 Generated', gradingResult.inline_issues.length, 'inline issues for highlighting');
    return gradingResult;

  } catch (error) {
    console.error('❌ UNIFIED GRADING ERROR:', error);
    throw error;
  }
}

/**
 * Legacy grading function for backward compatibility
 * @param {string} studentText - The student's essay text
 * @param {string} prompt - The assignment prompt
 * @param {string} classProfile - The class profile identifier
 * @returns {Promise<Object>} Grading results
 */
async function gradeLegacy(studentText, prompt, classProfile) {
  console.log("\n⚡ STARTING TWO-STEP GRADING PROCESS...");
  const result = await gradeEssay(studentText, prompt, classProfile);
  console.log("\n✅ GRADING COMPLETED SUCCESSFULLY!");
  return result;
}

export {
  gradeEssayUnified,
  gradeLegacy
};