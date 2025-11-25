// grader/grader-claude.js
// SIMPLIFIED GRADING with Claude: Mimics the same approach as grader-simple.js
// Uses Anthropic's Claude API instead of OpenAI

import Anthropic from "@anthropic-ai/sdk";
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

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Convert simple error format to system format (for compatibility)
 */
function convertToSystemFormat(simpleErrors, studentText) {
  const inline_issues = [];

  for (const error of simpleErrors) {
    // Use text matching to find position (like formatter does)
    // This removes the burden of offset calculation from Claude
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
 * Extract JSON from Claude's response (handles text before/after JSON)
 */
function extractJSON(text) {
  // Try to find JSON object in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  // If no match, try parsing the whole thing
  return JSON.parse(text);
}

/**
 * Count metrics separately (deterministic, low temperature)
 * Word count is now algorithmic for perfect consistency
 */
async function countMetrics(classProfile, studentText) {
  // Calculate word count algorithmically (100% accurate)
  const wordCount = countWords(studentText);
  console.log(`📊 Algorithmic word count: ${wordCount}`);

  const prompt = `Find which class vocabulary and grammar structures appear in this essay.

CLASS VOCABULARY:
${classProfile.vocabulary.join(', ')}

GRAMMAR STRUCTURES:
${classProfile.grammar.join(', ')}

TASK: Return ONLY the items from the lists above that you find in the essay below.

For vocabulary, count variants:
- Plurals, verb forms (negotiate→negotiating, negotiated)
- Misspellings (recieve→receive, enviroment→environment)
- With prefixes/suffixes (un-, re-, dis-, -able, -tion, etc.)
- Different forms (important→importantly, negotiate→negotiation)

Return JSON:
{
  "paragraph_count": <number>,
  "sentence_count": <number>,
  "class_vocabulary_used": ["word1", "word2"],
  "grammar_structures_used": ["structure1", "structure2"],
  "transition_words_found": ["however", "moreover"]
}

STUDENT TEXT:
"""${studentText}"""`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      temperature: 0.1, // Very low for consistency
      messages: [{ role: "user", content: prompt }]
    });

    const claudeMetrics = extractJSON(response.content[0].text);

    // Combine algorithmic word count with Claude metrics
    return {
      word_count: wordCount,
      paragraph_count: claudeMetrics.paragraph_count,
      sentence_count: claudeMetrics.sentence_count,
      class_vocabulary_used: claudeMetrics.class_vocabulary_used,
      grammar_structures_used: claudeMetrics.grammar_structures_used,
      transition_words_found: claudeMetrics.transition_words_found
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
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      temperature: 0.3, // Moderate - not too conservative, not too creative
      messages: [{ role: "user", content: prompt }]
    });

    const result = extractJSON(response.content[0].text);

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
  console.log("\n🚀 Starting SIMPLIFIED grading process with Claude...");

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

    const gradingResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      temperature: 0.2,
      messages: [{ role: "user", content: gradingPrompt }]
    });

    const gradingResult = extractJSON(gradingResponse.content[0].text);
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
    console.error("❌ Error in simplified grading with Claude:", error);

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
  console.log('=== STARTING SIMPLIFIED 3-STEP GRADING PROCESS WITH CLAUDE ===');
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
