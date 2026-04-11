// grader/grader-simple.js
// SIMPLIFIED GRADING: Mimics ChatGPT's natural performance
// Removes complexity that hurts error detection

import OpenAI from "openai";
import dotenv from "dotenv";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildSimpleErrorDetectionPrompt } from './error-detection-simple.js';
import { buildGradingPrompt } from './grading-prompt.js';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rubric = JSON.parse(readFileSync(join(__dirname, 'rubric.json'), 'utf8'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Convert simple error format to system format (for compatibility)
 */
function convertToSystemFormat(simpleErrors, studentText) {
  const inline_issues = [];

  for (const error of simpleErrors) {
    // Use text matching to find position (like formatter does)
    // This removes the burden of offset calculation from GPT
    const errorText = error.error_text;
    const index = studentText.indexOf(errorText);

    if (index !== -1) {
      inline_issues.push({
        category: error.category,
        text: errorText,
        start: index,
        end: index + errorText.length,
        correction: error.correction,
        explanation: error.explanation
      });
    } else {
      // If exact match fails, still include the error but let formatter handle it
      console.warn(`⚠️  Could not find exact match for: "${errorText}"`);
      inline_issues.push({
        category: error.category,
        text: errorText,
        start: 0,
        end: errorText.length,
        correction: error.correction,
        explanation: error.explanation
      });
    }
  }

  return inline_issues;
}

/**
 * Count word count algorithmically (100% consistent)
 */
function countWords(text) {
  // Split by whitespace and filter out empty strings
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Strip organizational header lines from a vocab or grammar list.
 *
 * The syllabus-extraction feature produces lists that may contain UNIT headers
 * and category subheaders prefixed with "# " or "## " (markdown-style), which
 * help teachers visually organize the profile textareas. Those header lines
 * must be filtered out before the list is sent to GPT for grading, since they
 * are not actual vocabulary/grammar items.
 *
 * Safe for profiles that don't use headers — they're just arrays of strings,
 * and no real vocab or grammar item starts with "#".
 *
 * @param {string[]} list
 * @returns {string[]}
 */
function stripHeaders(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(item => typeof item === 'string' && !item.trim().startsWith('#'));
}

/**
 * Count metrics separately (deterministic, low temperature)
 * Word count is now algorithmic for perfect consistency
 *
 * When the class profile does not specify vocabulary or grammar lists, we omit
 * those sections from the prompt entirely so GPT cannot invent matches against
 * an empty list. The returned object still includes empty arrays for those
 * fields so downstream display/formatting code continues to work unchanged.
 */
async function countMetrics(classProfile, studentText) {
  // Calculate word count algorithmically (100% accurate)
  const wordCount = countWords(studentText);
  console.log(`📊 Algorithmic word count: ${wordCount}`);

  // Strip organizational header lines (# UNIT X, ## Category) from the lists
  // before using them for grading. Headers are for teacher readability only;
  // they are not real vocab/grammar items.
  const cleanVocab = stripHeaders(classProfile.vocabulary);
  const cleanGrammar = stripHeaders(classProfile.grammar);

  const hasClassVocabulary = cleanVocab.length > 0;
  const hasClassGrammar = cleanGrammar.length > 0;

  // Build the prompt sections conditionally based on what the class profile specifies.
  const classVocabSection = hasClassVocabulary
    ? `CLASS VOCABULARY (${cleanVocab.length} items):
${cleanVocab.join(', ')}

`
    : '';

  const classGrammarSection = hasClassGrammar
    ? `CLASS GRAMMAR STRUCTURES (${cleanGrammar.length} items):
${cleanGrammar.join(', ')}

`
    : '';

  // Build the JSON schema GPT should return — only include class-list fields when relevant.
  const jsonFields = [
    '  "paragraph_count": <number>',
    '  "sentence_count": <number>',
  ];
  if (hasClassVocabulary) {
    jsonFields.push('  "class_vocabulary_used": ["word1", "word2"]');
  }
  if (hasClassGrammar) {
    jsonFields.push('  "grammar_structures_used": ["structure1", "structure2"]');
  }
  jsonFields.push('  "transition_words_found": ["however", "moreover"]');

  const matchingInstructions = (hasClassVocabulary || hasClassGrammar)
    ? `
Count exact matches (case-insensitive). For vocabulary, also count:
- Prefixes/suffixes (un-, re-, dis-, -able, -ive, -ness, -ment, -tion)
- Verb conjugations (negotiate → negotiating, negotiated, negotiates)
- Plural forms (responsibility → responsibilities, business → businesses)
- Different parts of speech (important → importantly, negotiate → negotiation)
- Comparative/superlative (big → bigger, biggest)
- Possessive forms (company's, companies')
- British vs American spelling (organise/organize, colour/color)
- Misspelled versions that are recognizable
`
    : '';

  const prompt = `Count the following metrics in this essay. Be precise and deterministic.

${classVocabSection}${classGrammarSection}Return JSON:
{
${jsonFields.join(',\n')}
}
${matchingInstructions}
STUDENT TEXT:
"""${studentText}"""`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1, // Very low for consistency
      response_format: { type: "json_object" }
    });

    const gptMetrics = JSON.parse(response.choices[0].message.content);

    // Combine algorithmic word count with GPT metrics.
    // When class profile fields are unspecified, force empty arrays regardless of
    // what GPT returned — downstream UI expects arrays and we don't want phantom matches.
    return {
      word_count: wordCount,
      paragraph_count: gptMetrics.paragraph_count,
      sentence_count: gptMetrics.sentence_count,
      class_vocabulary_used: hasClassVocabulary ? (gptMetrics.class_vocabulary_used || []) : [],
      grammar_structures_used: hasClassGrammar ? (gptMetrics.grammar_structures_used || []) : [],
      transition_words_found: gptMetrics.transition_words_found || []
    };
  } catch (error) {
    console.error("❌ Error counting metrics:", error.message);
    return {
      word_count: wordCount, // Still use algorithmic count on error
      paragraph_count: 0,
      sentence_count: 0,
      class_vocabulary_used: [],
      grammar_structures_used: [],
      transition_words_found: []
    };
  }
}

/**
 * STEP 1: Simple error detection (mimics ChatGPT approach)
 */
async function detectErrors(classProfile, studentText) {
  const prompt = buildSimpleErrorDetectionPrompt(classProfile, studentText);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3, // Moderate - not too conservative, not too creative
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);

    // Convert to system format
    const inline_issues = convertToSystemFormat(result.errors || [], studentText);

    return {
      inline_issues,
      corrected_text_minimal: studentText // Will be generated by system
    };

  } catch (error) {
    console.error("❌ Error in simple error detection:", error.message);
    throw error;
  }
}

/**
 * Main grading function
 */
export async function gradeEssaySimple(studentText, classProfile, progressCallback = null, studentNickname = null) {
  console.log("\n🚀 Starting SIMPLIFIED grading process...");

  try {
    // STEP 1: Detect errors (simple approach)
    if (progressCallback) {
      progressCallback({
        step: 'error_detection',
        status: 'in_progress',
        message: 'Detecting errors with simplified approach...'
      });
    }

    const errorDetection = await detectErrors(classProfile, studentText);
    console.log(`✅ Found ${errorDetection.inline_issues.length} errors`);

    // STEP 2: Count metrics separately
    if (progressCallback) {
      progressCallback({
        step: 'metrics',
        status: 'in_progress',
        message: 'Counting metrics...'
      });
    }

    const metrics = await countMetrics(classProfile, studentText);
    console.log(`✅ Metrics: ${metrics.word_count} words, ${metrics.transition_words_found.length} transitions`);

    // Combine metrics into errorDetection for grading prompt compatibility
    const errorDetectionResults = {
      ...errorDetection,
      vocabulary_count: metrics.word_count,
      class_vocabulary_used: metrics.class_vocabulary_used,
      grammar_structures_used: metrics.grammar_structures_used,
      transition_words_found: metrics.transition_words_found
    };

    // STEP 3: Grade with rubric
    if (progressCallback) {
      progressCallback({
        step: 'grading',
        status: 'in_progress',
        message: 'Applying rubric and calculating score...'
      });
    }

    const gradingPrompt = buildGradingPrompt(
      rubric,
      classProfile,
      classProfile.cefrLevel,
      studentText,
      errorDetectionResults,
      studentNickname // Pass the studentNickname parameter
    );

    const gradingResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: gradingPrompt }],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const gradingResult = JSON.parse(gradingResponse.choices[0].message.content);
    console.log(`✅ Final score: ${gradingResult.total?.points || gradingResult.score}/100`);

    // Combine results in the same format as grader-two-step.js
    const finalResult = {
      ...gradingResult, // Contains scores, total, teacher_notes, etc.
      inline_issues: errorDetection.inline_issues,
      corrected_text_minimal: errorDetection.corrected_text_minimal,
      meta: {
        word_count: metrics.word_count,
        vocabulary_count: metrics.word_count,
        class_vocabulary_used: metrics.class_vocabulary_used,
        grammar_structures_used: metrics.grammar_structures_used,
        transition_words_found: metrics.transition_words_found
      }
    };

    if (progressCallback) {
      progressCallback({
        step: 'complete',
        status: 'completed',
        message: 'Grading complete!'
      });
    }

    return finalResult;

  } catch (error) {
    console.error("❌ Error in simplified grading:", error);

    if (progressCallback) {
      progressCallback({
        step: 'error',
        status: 'error',
        message: error.message
      });
    }

    throw error;
  }
}

/**
 * Main grading function matching grader-hybrid.js signature
 * @param {string} studentText - The student's essay text
 * @param {string} prompt - The assignment prompt (unused in simple approach)
 * @param {number} classProfileId - The class profile ID
 * @param {string} studentNickname - Optional student nickname
 */
export async function gradeEssay(studentText, prompt, classProfileId, studentNickname) {
  console.log('=== STARTING SIMPLIFIED 3-STEP GRADING PROCESS ===');
  console.log('🏷️ Student nickname:', studentNickname || 'none provided');

  // Load class profile
  let classProfile = null;

  try {
    const prisma = new PrismaClient();
    classProfile = await prisma.class_profiles.findUnique({
      where: { id: classProfileId }
    });
    await prisma.$disconnect();

    if (classProfile) {
      console.log(`Profile loaded from database: ${classProfile.name}`);
    }
  } catch (dbError) {
    console.log('Database lookup failed, will try file system:', dbError.message);
  }

  if (!classProfile) {
    try {
      const profilesPath = join(__dirname, '..', 'class-profiles.json');
      const profilesData = JSON.parse(readFileSync(profilesPath, 'utf8'));
      classProfile = profilesData.profiles.find(p => p.id === classProfileId);

      if (classProfile) {
        console.log(`Profile loaded from file system: ${classProfile.name}`);
      }
    } catch (fileError) {
      console.log('File system lookup also failed:', fileError.message);
    }
  }

  if (!classProfile) {
    throw new Error(`Class profile ${classProfileId} not found in database or file system`);
  }

  const cefrLevel = classProfile.cefrLevel;
  console.log(`CEFR Level: ${cefrLevel}, Class Profile: ${classProfile.name}`);

  // Build classProfile object with vocabulary and grammar arrays
  const profileForGrading = {
    ...classProfile,
    vocabulary: classProfile.vocabulary || [],
    grammar: classProfile.grammar || []
  };

  // Call the simplified grading function with studentNickname
  const result = await gradeEssaySimple(studentText, profileForGrading, null, studentNickname);

  // Store studentNickname in result for later use
  if (studentNickname) {
    result.studentNickname = studentNickname;
  }

  return result;
}
