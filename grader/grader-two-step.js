// grader/grader-two-step.js
// TWO-STEP GRADING PROCESS: Error Detection + Scoring

import OpenAI from "openai";
import dotenv from "dotenv";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildErrorDetectionPrompt } from './error-detection-prompt.js';
import { buildGradingPrompt } from './grading-prompt.js';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rubric = JSON.parse(readFileSync(join(__dirname, 'rubric.json'), 'utf8'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Queue to manage concurrent requests and prevent rate limiting
let requestQueue = [];
let isProcessingQueue = false;
const MAX_CONCURRENT_REQUESTS = 1; // Serialize all requests to prevent rate limiting
const BASE_DELAY_BETWEEN_REQUESTS = 3000; // Base delay in milliseconds

// Token rate limiting tracking
let tokenUsageWindow = [];
const TOKENS_PER_MINUTE_LIMIT = 30000; // OpenAI's TPM limit
const WINDOW_SIZE_MS = 60000; // 1 minute window
const SAFETY_BUFFER = 0.8; // Use only 80% of limit for safety

// Batch processing tracking for cooling periods
let essayProcessedCount = 0;
const ESSAYS_PER_BATCH = 6; // Process 6 essays before cooling period
const COOLING_PERIOD_MS = 90000; // 1.5 minutes cooling period
let lastCoolingPeriod = 0;

/**
 * Retry utility with exponential backoff for rate limiting
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if it's a rate limit error
      if (error.status === 429 || error.message?.includes('Rate limit') || error.message?.includes('429')) {
        console.log(`🔄 Rate limit hit on attempt ${attempt + 1}/${maxRetries + 1}`);

        if (attempt < maxRetries) {
          // Extract retry delay from error message if available
          let retryDelay = baseDelay * Math.pow(2, attempt); // Exponential backoff

          // Try to parse suggested delay from OpenAI error message
          const delayMatch = error.message?.match(/try again in ([\d.]+)s/);
          if (delayMatch) {
            retryDelay = Math.max(retryDelay, parseFloat(delayMatch[1]) * 1000 + 500); // Add 500ms buffer
          }

          console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
      }

      // If it's not a rate limit error or we've exhausted retries, throw the error
      throw error;
    }
  }

  throw lastError;
}

/**
 * Track token usage for rate limiting
 */
function trackTokenUsage(tokensUsed) {
  const now = Date.now();
  tokenUsageWindow.push({ timestamp: now, tokens: tokensUsed });

  // Remove entries older than 1 minute
  tokenUsageWindow = tokenUsageWindow.filter(entry =>
    now - entry.timestamp < WINDOW_SIZE_MS
  );
}

/**
 * Calculate current token usage in the past minute
 */
function getCurrentTokenUsage() {
  const now = Date.now();
  const recentUsage = tokenUsageWindow.filter(entry =>
    now - entry.timestamp < WINDOW_SIZE_MS
  );
  return recentUsage.reduce((total, entry) => total + entry.tokens, 0);
}

/**
 * Check if we need a cooling period based on batch processing
 */
function checkCoolingPeriod() {
  const now = Date.now();

  // Check if we've processed enough essays to warrant a cooling period
  if (essayProcessedCount > 0 && essayProcessedCount % ESSAYS_PER_BATCH === 0) {
    const timeSinceLastCooling = now - lastCoolingPeriod;

    // Only enforce cooling period if we haven't had one recently
    if (timeSinceLastCooling > COOLING_PERIOD_MS) {
      console.log(`🧊 COOLING PERIOD: Processed ${essayProcessedCount} essays. Waiting ${COOLING_PERIOD_MS/1000}s before continuing...`);
      lastCoolingPeriod = now;
      return COOLING_PERIOD_MS;
    }
  }

  return 0;
}

/**
 * Calculate dynamic delay based on token usage and batch cooling
 */
function calculateDynamicDelay(estimatedTokens = 3000) {
  // First check if we need a batch cooling period
  const coolingDelay = checkCoolingPeriod();
  if (coolingDelay > 0) {
    return coolingDelay;
  }

  const currentUsage = getCurrentTokenUsage();
  const safeLimit = TOKENS_PER_MINUTE_LIMIT * SAFETY_BUFFER;
  const remainingCapacity = safeLimit - currentUsage;

  console.log(`🔍 Token usage check: ${currentUsage}/${safeLimit} tokens used (${Math.round(currentUsage/safeLimit*100)}%)`);

  if (remainingCapacity < estimatedTokens) {
    // Need to wait for tokens to become available
    const excessTokens = estimatedTokens - remainingCapacity;
    const delayForTokens = Math.ceil((excessTokens / safeLimit) * WINDOW_SIZE_MS);
    const totalDelay = Math.max(BASE_DELAY_BETWEEN_REQUESTS, delayForTokens);

    console.log(`⚠️ Token capacity low! Need ${estimatedTokens} tokens, only ${remainingCapacity} available. Adding ${totalDelay}ms delay.`);
    return totalDelay;
  }

  return BASE_DELAY_BETWEEN_REQUESTS;
}

/**
 * Queue-based OpenAI API call to prevent rate limiting
 */
async function queuedOpenAICall(apiCall, estimatedTokens = 3000) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ apiCall, resolve, reject, estimatedTokens });
    processQueue();
  });
}

async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;

  isProcessingQueue = true;
  console.log(`📋 Queue processing started with ${requestQueue.length} requests`);

  while (requestQueue.length > 0) {
    const { apiCall, resolve, reject, estimatedTokens } = requestQueue.shift();

    try {
      console.log(`🚀 Processing queued request (${requestQueue.length} remaining in queue)`);
      const startTime = Date.now();
      const result = await retryWithBackoff(apiCall);
      const duration = Date.now() - startTime;

      // Track actual token usage from the response
      const actualTokens = result.usage?.total_tokens || estimatedTokens;
      trackTokenUsage(actualTokens);

      console.log(`✅ Request completed in ${duration}ms (${actualTokens} tokens used)`);
      resolve(result);
    } catch (error) {
      console.error('❌ Queued request failed:', error.message);
      reject(error);
    }

    // Calculate dynamic delay based on token usage and batch cooling
    if (requestQueue.length > 0) {
      const nextEstimatedTokens = requestQueue[0]?.estimatedTokens || 3000;
      const delay = calculateDynamicDelay(nextEstimatedTokens);

      if (delay >= COOLING_PERIOD_MS) {
        console.log(`🧊 COOLING PERIOD: ${delay/1000}s wait (${requestQueue.length} requests remaining)`);
      } else {
        console.log(`⏳ Standard delay: ${delay}ms before next request (${requestQueue.length} requests remaining)`);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.log(`✅ Queue processing completed`);
  isProcessingQueue = false;
}

export async function gradeEssay(studentText, prompt, classProfileId) {
  // Increment essay counter for batch cooling period tracking
  essayProcessedCount++;

  console.log('=== STARTING TWO-STEP GRADING PROCESS ===');
  console.log(`📊 Processing essay #${essayProcessedCount} (batch position: ${((essayProcessedCount - 1) % ESSAYS_PER_BATCH) + 1}/${ESSAYS_PER_BATCH})`);
  console.log('DEBUG: classProfileId received:', classProfileId);
  console.log('DEBUG: classProfileId type:', typeof classProfileId);
  console.log('FORCING NODEMON RESTART');
  
  // Load class profile from database first, then fall back to file
  let classProfile = null;

  // Try database first
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

  // Fall back to file system if not found in database
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

  // STEP 1: AGGRESSIVE ERROR DETECTION
  console.log('\n=== STEP 1: ERROR DETECTION ===');
  const errorDetectionResults = await detectErrors(studentText, classProfile);
  
  // STEP 2: RUBRIC-BASED GRADING
  console.log('\n=== STEP 2: GRADING ===');
  const gradingResults = await gradeBasedOnRubric(studentText, classProfile, cefrLevel, errorDetectionResults);
  
  // STEP 3: COMBINE RESULTS
  console.log('\n=== STEP 3: COMBINING RESULTS ===');

  // Backup vocabulary counting if AI didn't provide accurate count
  const aiVocabCount = errorDetectionResults.vocabulary_count || 0;
  const backupVocabCount = countVocabularyUsage(studentText, classProfile.vocabulary);
  const finalVocabCount = Math.max(aiVocabCount, backupVocabCount);

  console.log(`Vocabulary counting: AI=${aiVocabCount}, Backup=${backupVocabCount}, Final=${finalVocabCount}`);

  // Backup transition counting if AI didn't provide them
  const aiTransitions = errorDetectionResults.transition_words_found || [];
  const backupTransitions = countTransitionWords(studentText);
  const finalTransitions = aiTransitions.length > 0 ? aiTransitions : backupTransitions;

  // Backup class vocabulary identification if AI didn't provide them
  const aiClassVocab = errorDetectionResults.class_vocabulary_used || [];
  const backupClassVocab = identifyClassVocabulary(studentText, classProfile.vocabulary);
  const finalClassVocab = aiClassVocab.length > 0 ? aiClassVocab : backupClassVocab;

  // Backup grammar structure identification if AI didn't provide them
  const aiGrammarStructures = errorDetectionResults.grammar_structures_used || [];
  const backupGrammarStructures = identifyGrammarStructures(studentText, classProfile.grammar);
  const finalGrammarStructures = aiGrammarStructures.length > 0 ? aiGrammarStructures : backupGrammarStructures;

  console.log(`Transition words: AI=${aiTransitions.length}, Backup=${backupTransitions.length}, Final=${finalTransitions.length}`);
  console.log(`Class vocabulary: AI=${aiClassVocab.length}, Backup=${backupClassVocab.length}, Final=${finalClassVocab.length}`);
  console.log(`Grammar structures: AI=${aiGrammarStructures.length}, Backup=${backupGrammarStructures.length}, Final=${finalGrammarStructures.length}`);

  const finalResults = {
    ...gradingResults,
    inline_issues: errorDetectionResults.inline_issues,
    corrected_text_minimal: errorDetectionResults.corrected_text_minimal,
    meta: {
      word_count: studentText.split(/\s+/).filter(word => word.length > 0).length,
      vocabulary_count: finalVocabCount,
      class_vocabulary_used: finalClassVocab,
      grammar_structures_used: finalGrammarStructures,
      transition_words_found: finalTransitions
    }
  };

  console.log(`Final combined results: ${finalResults.inline_issues.length} errors, ${finalResults.total.points}/${finalResults.total.out_of} points`);
  return finalResults;
}

async function detectErrors(studentText, classProfile) {
  const prompt = buildErrorDetectionPrompt(classProfile, studentText);
  
  console.log('Calling GPT for error detection...');
  console.log(`Student text (${studentText.length} chars): "${studentText.substring(0, 100)}..."`);
  
  // Estimate tokens for error detection (prompt + student text + response)
  const estimatedTokens = Math.ceil((prompt.length + studentText.length) * 0.75) + 1500; // ~0.75 chars per token + response buffer

  const response = await queuedOpenAICall(() => openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Analyze this text for errors: "${studentText}"` }
    ],
    temperature: 0.1, // Lowered to match grading temperature for maximum consistency
  }), estimatedTokens);

  console.log('=== RAW ERROR DETECTION RESPONSE ===');
  let content = response.choices[0].message.content;
  console.log('RAW RESPONSE LENGTH:', content?.length);
  console.log('RAW RESPONSE PREVIEW:', content?.substring(0, 500));
  console.log('FULL RAW RESPONSE:');
  console.log(content);
  console.log('=== END RAW RESPONSE ===');
  
  try {
    // Clean JSON - remove markdown code blocks
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(content);

    // Post-process to add "Final text should be" to ALL corrections
    if (result.inline_issues) {
      result.inline_issues = result.inline_issues.map(issue => {
        if (issue.correction && issue.explanation && !issue.explanation.includes('Final text should be')) {
          issue.explanation = `${issue.explanation}. Final text should be "${issue.correction}".`;
        }
        return issue;
      });
    }
    
    // Apply safety net patches
    if (result.inline_issues) {
      console.log(`GPT found ${result.inline_issues.length} errors before patching`);
      console.log('BEFORE PATCHING - First 3 issues:');
      result.inline_issues.slice(0, 3).forEach((issue, i) => {
        console.log(`  ${i}: "${issue.text}" (${issue.start}-${issue.end}) [${issue.category}]`);
      });
      
      result.inline_issues = splitLongSpans(studentText, result.inline_issues);
      console.log(`After splitLongSpans: ${result.inline_issues.length} errors`);
      
      result.inline_issues = patchHomeworkCollocations(studentText, result.inline_issues);
      console.log(`After patchHomeworkCollocations: ${result.inline_issues.length} errors`);
      
      result.inline_issues = patchCommonErrors(studentText, result.inline_issues);
      console.log(`After patchCommonErrors: ${result.inline_issues.length} errors`);
      
      result.inline_issues = patchModalAndTooUsage(studentText, result.inline_issues);
      console.log(`After patchModalAndTooUsage: ${result.inline_issues.length} errors`);
      
      result.inline_issues = patchContextualCorrections(studentText, result.inline_issues);
      console.log(`After patchContextualCorrections: ${result.inline_issues.length} errors`);
      
      result.inline_issues = patchVocabularyUsage(studentText, result.inline_issues);
      console.log(`After patchVocabularyUsage: ${result.inline_issues.length} errors`);
      
      console.log('AFTER ALL PATCHING - First 3 issues:');
      result.inline_issues.slice(0, 3).forEach((issue, i) => {
        console.log(`  ${i}: "${issue.text}" (${issue.start}-${issue.end}) [${issue.category}]`);
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error parsing JSON from error detection:', error);
    throw new Error(`Failed to parse error detection response: ${error.message}`);
  }
}

async function gradeBasedOnRubric(studentText, classProfile, cefrLevel, errorDetectionResults) {
  const prompt = buildGradingPrompt(rubric, classProfile, cefrLevel, studentText, errorDetectionResults);

  console.log('Calling GPT for rubric-based grading...');
  console.log(`Errors to consider: ${errorDetectionResults.inline_issues.length} issues`);
  
  // Estimate tokens for grading (prompt + student text + errors + response)
  const gradingEstimatedTokens = Math.ceil((prompt.length + studentText.length) * 0.75) + 1000; // Grading usually shorter response

  const response = await queuedOpenAICall(() => openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Grade this essay based on the detected errors and rubric.` }
    ],
    temperature: 0.1, // Lowered further for maximum consistency
  }), gradingEstimatedTokens);

  console.log('=== RAW GRADING RESPONSE ===');
  let content = response.choices[0].message.content;
  console.log(content);
  console.log('=== END RAW RESPONSE ===');
  
  try {
    // Clean JSON - remove markdown code blocks and extra text
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Find JSON object boundaries
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      content = content.substring(jsonStart, jsonEnd + 1);
    }
    
    console.log(`Cleaned JSON length: ${content.length} chars`);
    console.log(`JSON preview: ${content.substring(0, 200)}...`);
    
    const result = JSON.parse(content);
    
    // Ensure scores have correct category names
    const expectedCategories = ['grammar', 'vocabulary', 'spelling', 'mechanics', 'fluency', 'layout', 'content'];
    const scoreKeys = Object.keys(result.scores || {});
    
    console.log(`Grading categories found: ${scoreKeys.join(', ')}`);
    
    // Fix common category name issues
    if (result.scores && result.scores['mechanics-punctuation']) {
      result.scores.mechanics = result.scores['mechanics-punctuation'];
      delete result.scores['mechanics-punctuation'];
    }
    
    // Update total score
    const newTotal = Object.values(result.scores || {}).reduce((sum, score) => sum + score.points, 0);
    const maxTotal = Object.values(result.scores || {}).reduce((sum, score) => sum + score.out_of, 0);

    if (result.total) {
      result.total.points = newTotal;
      result.total.out_of = maxTotal;
    }

    console.log(`TOTAL SCORE: ${newTotal} (out of ${maxTotal})`);
    console.log('=== RUBRIC-BASED SCORING COMPLETE ===\n');
    
    return result;
  } catch (error) {
    console.error('Error parsing JSON from grading:', error);
    throw new Error(`Failed to parse grading response: ${error.message}`);
  }
}

// SAFETY NET FUNCTIONS (kept from original)
function patchHomeworkCollocations(text, issues) {
  const newIssues = [];
  
  const collocations = [
    { wrong: "do homework", correct: "do my homework", context: "personal" },
    { wrong: "make homework", correct: "do homework" },
    { wrong: "study homework", correct: "do homework" }
  ];
  
  for (const col of collocations) {
    const regex = new RegExp(`\\\\b${col.wrong}\\\\b`, 'gi');
    for (const match of text.matchAll(regex)) {
      if (!isAlreadyCovered(match.index, match.index + col.wrong.length, issues)) {
        newIssues.push({
          category: "vocabulary",
          text: col.wrong,
          start: match.index,
          end: match.index + col.wrong.length,
          correction: col.correct,
          explanation: `Collocation error: "${col.wrong}" should be "${col.correct}".${isMultiWordHighlight(col.wrong) ? ` Final text should be "${col.correct}".` : ''}`
        });
      }
    }
  }
  
  if (newIssues.length > 0) {
    console.log(`Added ${newIssues.length} homework collocation fixes:`, newIssues.map(i => `${i.text} → ${i.correction}`));
  }
  
  return [...issues, ...newIssues];
}

function patchCommonErrors(text, issues) {
  const newIssues = [];
  
  // 1. Lowercase "i" (personal pronoun)
  const iRegex = /\\b i \\b/g;
  for (const match of text.matchAll(iRegex)) {
    if (!isAlreadyCovered(match.index + 1, match.index + 2, issues)) {
      newIssues.push({
        category: "mechanics",
        text: "i",
        start: match.index + 1,
        end: match.index + 2,
        correction: "I",
        explanation: "Personal pronoun 'I' must always be capitalized"
      });
    }
  }
  
  // 2. Common spelling errors
  const commonSpellingErrors = [
    { wrong: "wekend", correct: "weekend" },
    { wrong: "recieve", correct: "receive" },
    { wrong: "seperate", correct: "separate" },
    { wrong: "definately", correct: "definitely" }
  ];
  
  for (const error of commonSpellingErrors) {
    const regex = new RegExp(`\\\\b${error.wrong}\\\\b`, 'gi');
    for (const match of text.matchAll(regex)) {
      if (!isAlreadyCovered(match.index, match.index + error.wrong.length, issues)) {
        newIssues.push({
          category: "spelling",
          text: error.wrong,
          start: match.index,
          end: match.index + error.wrong.length,
          correction: error.correct,
          explanation: `Misspelling: "${error.wrong}" should be "${error.correct}".${isMultiWordHighlight(error.wrong) ? ` Final text should be "${error.correct}".` : ''}`
        });
      }
    }
  }
  
  if (newIssues.length > 0) {
    console.log(`Added ${newIssues.length} missing common errors:`, newIssues.map(i => `${i.text} → ${i.correction}`));
  }
  
  return [...issues, ...newIssues];
}

function patchModalAndTooUsage(text, issues) {
  const newIssues = [];

  // 1) 'to can' → 'to be able to'
  for (const m of text.matchAll(/\\bto\\s+can\\b/gi)) {
    const start = m.index, end = start + m[0].length;
    if (!isAlreadyCovered(start, end, issues)) {
      newIssues.push({
        category: "grammar",
        text: m[0],
        start,
        end,
        correction: "to be able to",
        explanation: `Modal 'can' cannot follow 'to' - use 'be able to' instead. Final text should be "to be able to".`
      });
    }
  }

  // 2) 'must to' / 'should to' → 'must' / 'should'
  for (const m of text.matchAll(/\\b(must|should)\\s+to\\b/gi)) {
    const start = m.index, end = start + m[0].length;
    const modal = m[1].toLowerCase();
    if (!isAlreadyCovered(start, end, issues)) {
      newIssues.push({
        category: "grammar",
        text: m[0],
        start,
        end,
        correction: modal,
        explanation: `Modal '${modal}' doesn't need 'to' after it.${isMultiWordHighlight(m[0]) ? ` Final text should be "${modal}".` : ''}`
      });
    }
  }

  // 3) "too ADJ to can VERB" → flag both parts
  for (const m of text.matchAll(/\\btoo\\s+([a-z]+)\\s+to\\s+can\\s+([a-z]+)\\b/gi)) {
    const wholeStart = m.index, wholeEnd = wholeStart + m[0].length;

    // (a) modal fix
    const canStart = text.indexOf("to can", wholeStart);
    if (canStart !== -1 && !isAlreadyCovered(canStart, canStart + 6, issues)) {
      newIssues.push({
        category: "grammar",
        text: "to can",
        start: canStart,
        end: canStart + 6,
        correction: "to be able to",
        explanation: `Modal 'can' cannot follow 'to' - use 'be able to' instead. Final text should be "to be able to".`
      });
    }

    // (b) 'too' choice (only when it doesn't express excess)
    if (!isAlreadyCovered(wholeStart, wholeEnd, issues)) {
      newIssues.push({
        category: "grammar",
        text: m[0],
        start: wholeStart,
        end: wholeEnd,
        correction: m[0].replace(/too/, "very").replace(/to can/, "to be able to"),
        explanation: `Consider using 'very' or 'so' instead of 'too' when not expressing excess. Final text should be "${m[0].replace(/too/, "very").replace(/to can/, "to be able to")}".`
      });
    }
  }

  if (newIssues.length > 0) {
    console.log(`Added ${newIssues.length} modal/too usage errors:`, newIssues.map(i => `${i.text} → ${i.correction}`));
  }

  return [...issues, ...newIssues];
}

function isAlreadyCovered(start, end, existingIssues) {
  return existingIssues.some(issue => {
    // Handle both old (offsets) and new (start/end) formats
    const issueStart = issue.offsets?.start ?? issue.start;
    const issueEnd = issue.offsets?.end ?? issue.end;
    if (issueStart === undefined || issueEnd === undefined) return false;
    // Check for any overlap
    return !(start >= issueEnd || end <= issueStart);
  });
}

// Split overly long error spans into smaller, specific issues
function splitLongSpans(text, issues) {
  const newIssues = [];
  const MAX_SPAN_LENGTH = 30; // Maximum characters for atomic errors
  const MAX_WORD_COUNT = 4; // Maximum words for atomic errors
  const MECHANICS_MAX_WORDS = 2; // Even stricter for mechanics

  for (const issue of issues) {
    const start = issue.start || issue.offsets?.start;
    const end = issue.end || issue.offsets?.end;

    if (start === undefined || end === undefined) {
      newIssues.push(issue);
      continue;
    }

    const spanText = text.slice(start, end);
    const wordCount = spanText.split(/\s+/).filter(word => word.length > 0).length;
    const charLength = end - start;
    const category = issue.category || issue.type || '';

    // Special handling for mechanics - be extra strict
    const isMechanics = category.includes('mechanics');
    const maxWords = isMechanics ? MECHANICS_MAX_WORDS : MAX_WORD_COUNT;

    // If span is acceptable length, keep as-is
    if (charLength <= MAX_SPAN_LENGTH && wordCount <= maxWords) {
      newIssues.push(issue);
      continue;
    }

    // Attempt to split long spans into atomic errors
    console.warn(`🔄 Attempting to split long span (${wordCount} words, ${charLength} chars): "${spanText}"`);
    console.warn(`   Category: ${category}, Range: ${start}-${end}`);

    const atomicErrors = attemptAtomicSplit(text, spanText, start, end, category, issue);

    if (atomicErrors.length > 0) {
      console.log(`✅ Successfully split into ${atomicErrors.length} atomic errors`);
      newIssues.push(...atomicErrors);
    } else {
      // If we can't split it intelligently, apply stricter filtering
      if (isMechanics && wordCount > MECHANICS_MAX_WORDS) {
        console.warn(`❌ REJECTING overly broad mechanics error: "${spanText}"`);
        continue; // Skip entirely
      }

      // Keep with warning flag for manual review
      newIssues.push({
        ...issue,
        _warning: 'long_span_unsplittable',
        _word_count: wordCount,
        _char_length: charLength
      });
    }
  }

  const splitCount = newIssues.filter(issue => issue._split_from_group).length;
  const rejectedCount = issues.length - newIssues.length + splitCount;

  if (splitCount > 0) {
    console.log(`🔄 Successfully split ${splitCount} atomic errors from grouped spans`);
  }
  if (rejectedCount > 0) {
    console.warn(`❌ Rejected ${rejectedCount} overly broad error spans`);
  }

  return newIssues;
}

function attemptAtomicSplit(fullText, spanText, spanStart, spanEnd, originalCategory, originalIssue) {
  const atomicErrors = [];

  // Common error patterns for intelligent splitting
  const errorPatterns = [
    // Spelling errors - common misspellings
    { pattern: /\b(recieve|recieved|recieving)\b/gi, category: 'spelling', correct: (match) => match.replace(/ie/g, 'ei') },
    { pattern: /\b(seperate|seperated|seperating)\b/gi, category: 'spelling', correct: () => 'separate' },
    { pattern: /\b(definately)\b/gi, category: 'spelling', correct: () => 'definitely' },
    { pattern: /\b(commond)\b/gi, category: 'spelling', correct: () => 'common' },
    { pattern: /\b(tall me)\b/gi, category: 'spelling', correct: () => 'tell me' },
    { pattern: /\b(bussiness)\b/gi, category: 'spelling', correct: () => 'business' },

    // Grammar errors - preposition mistakes
    { pattern: /\bheard for\b/gi, category: 'grammar', correct: () => 'heard from' },
    { pattern: /\bfor one friend\b/gi, category: 'grammar', correct: () => 'from a friend' },
    { pattern: /\bto can\b/gi, category: 'grammar', correct: () => 'to be able to' },
    { pattern: /\bthat's right \?/gi, category: 'grammar', correct: () => 'is that right?' },

    // Mechanics errors - capitalization and punctuation
    { pattern: /\bi\b(?=\s)/g, category: 'mechanics', correct: () => 'I' },
    { pattern: /\bdont\b/gi, category: 'mechanics', correct: () => "don't" },
    { pattern: /\bcant\b/gi, category: 'mechanics', correct: () => "can't" },
    { pattern: /\bwont\b/gi, category: 'mechanics', correct: () => "won't" },
  ];

  // Find all errors within the span
  for (const errorPattern of errorPatterns) {
    const matches = [...spanText.matchAll(errorPattern.pattern)];

    for (const match of matches) {
      const errorStart = spanStart + match.index;
      const errorEnd = errorStart + match[0].length;
      const errorText = match[0];
      const correction = errorPattern.correct(match[0]);

      // Skip if this exact range is already covered
      if (atomicErrors.some(e => e.start === errorStart && e.end === errorEnd)) {
        continue;
      }

      atomicErrors.push({
        category: errorPattern.category,
        text: errorText,
        start: errorStart,
        end: errorEnd,
        correction: correction,
        explanation: generateExplanation(errorPattern.category, errorText, correction),
        _split_from_group: true,
        _original_span: spanText,
        _original_category: originalCategory
      });
    }
  }

  // If we found atomic errors, return them
  if (atomicErrors.length > 0) {
    return atomicErrors;
  }

  // Fallback: if it's a vocabulary error, try to extract the key problematic word
  if (originalCategory === 'vocabulary' && spanText.split(/\s+/).length <= 3) {
    const words = spanText.split(/\s+/);
    const keyWord = words[0]; // Take first word as likely culprit

    return [{
      category: 'vocabulary',
      text: keyWord,
      start: spanStart,
      end: spanStart + keyWord.length,
      correction: originalIssue.correction || keyWord,
      explanation: originalIssue.explanation || `Word choice issue with "${keyWord}"${isMultiWordHighlight(keyWord) ? `. Final text should be "${originalIssue.correction || keyWord}".` : ''}`,
      _split_from_group: true,
      _original_span: spanText,
      _original_category: originalCategory
    }];
  }

  return []; // Couldn't split intelligently
}

function isMultiWordHighlight(text) {
  // Check if text contains spaces (multiple words) or is unusually long for a single word
  return text.includes(' ') || text.length > 12;
}

function generateExplanation(category, errorText, correction) {
  const isMultiWord = isMultiWordHighlight(errorText);
  const finalTextSuffix = isMultiWord ? ` Final text should be "${correction}".` : '';

  switch (category) {
    case 'spelling':
      return `Misspelling: "${errorText}" should be "${correction}".${finalTextSuffix}`;
    case 'grammar':
      return `Grammar error: "${errorText}" should be "${correction}".${finalTextSuffix}`;
    case 'mechanics':
      return `Mechanics error: "${errorText}" should be "${correction}".${finalTextSuffix}`;
    default:
      return `Error: "${errorText}" should be "${correction}".${finalTextSuffix}`;
  }
}

// Improve contextual word corrections based on surrounding grammar
function patchContextualCorrections(text, issues) {
  const correctedIssues = [];
  
  for (const issue of issues) {
    let correctedIssue = { ...issue };
    
    // Handle verb vs noun confusion in corrections
    if (issue.category === 'spelling' || issue.category === 'vocabulary') {
      const start = issue.start || issue.offsets?.start;
      const end = issue.end || issue.offsets?.end;
      
      if (start !== undefined && end !== undefined) {
        const beforeText = text.slice(Math.max(0, start - 20), start).toLowerCase();
        const afterText = text.slice(end, Math.min(text.length, end + 20)).toLowerCase();
        const errorText = issue.text.toLowerCase();
        
        // Check for common verb/noun confusion patterns
        const verbIndicators = ['to ', 'want to', 'going to', 'need to', 'like to', 'have to'];
        const nounIndicators = ['the ', 'a ', 'an ', 'this ', 'that ', 'my ', 'your'];
        
        const needsVerb = verbIndicators.some(indicator => beforeText.endsWith(indicator));
        const needsNoun = nounIndicators.some(indicator => beforeText.endsWith(indicator));
        
        // Fix specific known patterns
        if (errorText.includes('negosation') && needsVerb) {
          correctedIssue.correction = 'negotiate';
          correctedIssue.explanation = 'After "to", use the verb form "negotiate" not the noun "negotiation"';
        } else if (errorText.includes('negosation') && needsNoun) {
          correctedIssue.correction = 'negotiation';
          correctedIssue.explanation = 'As a noun, the correct spelling is "negotiation"';
        }
        
        // Other common verb/noun confusions
        const verbNounFixes = {
          'creation': { verb: 'create', noun: 'creation' },
          'organization': { verb: 'organize', noun: 'organization' },
          'preparation': { verb: 'prepare', noun: 'preparation' },
          'communication': { verb: 'communicate', noun: 'communication' }
        };
        
        for (const [baseWord, forms] of Object.entries(verbNounFixes)) {
          if (errorText.includes(baseWord.slice(0, -2))) { // Partial match
            if (needsVerb && issue.correction === baseWord) {
              correctedIssue.correction = forms.verb;
              correctedIssue.explanation = `After "to", use the verb form "${forms.verb}" not the noun "${forms.noun}"`;
            }
          }
        }
      }
    }
    
    correctedIssues.push(correctedIssue);
  }
  
  const changedCount = correctedIssues.filter((issue, i) => 
    issue.correction !== issues[i].correction
  ).length;
  
  if (changedCount > 0) {
    console.log(`✏️ Fixed ${changedCount} contextual corrections based on grammar patterns`);
  }
  
  return correctedIssues;
}

// Validate vocabulary usage patterns and collocations
function patchVocabularyUsage(text, issues) {
  const newIssues = [];
  
  // Business vocabulary usage patterns
  const vocabularyPatterns = [
    {
      wrong: /\bcircle back\s+that\s+we\s+have\b/gi,
      wrongPhrase: "circle back that we have",
      correction: "circling back about what we discussed",
      explanation: "We don't 'have' circle backs. Use 'circle back about' or 'circle back on' what was discussed. Final text should be \"circling back about what we discussed\"."
    },
    {
      wrong: /\bdo\s+business\s+with\b/gi,
      wrongPhrase: "do business with",
      correction: "do business with",
      explanation: "Correct usage - 'do business with' someone",
      skip: true // This is actually correct
    },
    {
      wrong: /\bmake\s+a\s+deal\s+with\b/gi,
      wrongPhrase: "make a deal with",
      correction: "make a deal with",
      explanation: "Correct usage",
      skip: true // This is actually correct
    },
    {
      wrong: /\bdrop\s+all\s+the\s+questions\b/gi,
      wrongPhrase: "drop all the questions",
      correction: "ask all the questions",
      explanation: "'Drop questions' is unusual - typically we 'ask questions' or 'address questions'. Final text should be \"ask all the questions\"."
    },
    {
      wrong: /\bteamwork\s+have\b/gi,
      wrongPhrase: "teamwork have",
      correction: "team has",
      explanation: "Use 'team' (countable) when referring to people, not 'teamwork' (uncountable concept). Final text should be \"team has\"."
    },
    {
      wrong: /\bgive\s+us\s+feedback\b/gi,
      wrongPhrase: "give us feedback",
      correction: "give us feedback",
      explanation: "Correct usage",
      skip: true // This is actually correct
    }
  ];
  
  for (const pattern of vocabularyPatterns) {
    if (pattern.skip) continue; // Skip patterns that are actually correct
    
    for (const match of text.matchAll(pattern.wrong)) {
      const start = match.index;
      const end = start + match[0].length;
      
      if (!isAlreadyCovered(start, end, issues)) {
        newIssues.push({
          category: "vocabulary",
          text: pattern.wrongPhrase,
          start,
          end,
          correction: pattern.correction,
          explanation: pattern.explanation
        });
      }
    }
  }
  
  // Check for common collocation errors
  const collocationErrors = [
    {
      wrong: /\bmake\s+homework\b/gi,
      phrase: "make homework",
      correction: "do homework",
      explanation: "Use 'do homework', not 'make homework'. Final text should be \"do homework\"."
    },
    {
      wrong: /\bmake\s+a\s+mistake\b/gi,
      phrase: "make a mistake", 
      correction: "make a mistake",
      explanation: "Correct usage",
      skip: true
    },
    {
      wrong: /\bdo\s+a\s+mistake\b/gi,
      phrase: "do a mistake",
      correction: "make a mistake", 
      explanation: "Use 'make a mistake', not 'do a mistake'. Final text should be \"make a mistake\"."
    }
  ];
  
  for (const error of collocationErrors) {
    if (error.skip) continue;
    
    for (const match of text.matchAll(error.wrong)) {
      const start = match.index;
      const end = start + match[0].length;
      
      if (!isAlreadyCovered(start, end, issues)) {
        newIssues.push({
          category: "vocabulary",
          text: error.phrase,
          start,
          end,
          correction: error.correction,
          explanation: error.explanation
        });
      }
    }
  }
  
  if (newIssues.length > 0) {
    console.log(`📚 Added ${newIssues.length} vocabulary usage/collocation errors:`,
      newIssues.map(i => `"${i.text}" → "${i.correction}"`));
  }

  return [...issues, ...newIssues];
}

/**
 * Backup vocabulary counting function
 * Counts vocabulary usage from class profile against student text
 */
function countVocabularyUsage(studentText, vocabulary) {
  if (!vocabulary || vocabulary.length === 0) {
    return 0;
  }

  const text = studentText.toLowerCase();
  let count = 0;
  const foundWords = new Set(); // Avoid double counting

  // Define prefixes and suffixes to check
  const prefixes = ['un-', 're-', 'in-', 'im-', 'il-', 'ir-', 'dis-', 'pre-', 'mis-', 'non-', 'inter-', 'sub-', 'super-', 'anti-'];
  const suffixes = ['-able', '-ible', '-ive', '-ness', '-ment', '-tion', '-sion', '-ity', '-ence', '-ship'];

  for (const vocabItem of vocabulary) {
    const item = vocabItem.toLowerCase().trim();

    // Skip metadata entries
    if (item.includes('prefix') || item.includes('suffix') || item.includes('(any word')) {
      continue;
    }

    // Check for exact word/phrase matches
    if (item.includes(' ')) {
      // Multi-word phrases
      if (text.includes(item) && !foundWords.has(item)) {
        foundWords.add(item);
        count++;
        console.log(`Found vocabulary phrase: "${item}"`);
      }
    } else {
      // Single words - check for word boundaries
      const escapedItem = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordRegex = new RegExp(`\\b${escapedItem}\\b`, 'gi');
      if (wordRegex.test(text) && !foundWords.has(item)) {
        foundWords.add(item);
        count++;
        console.log(`Found vocabulary word: "${item}"`);
      }
    }
  }

  // Check for prefix usage
  const words = text.split(/\s+/).map(w => w.replace(/[^\w]/g, '')); // Remove punctuation
  for (const word of words) {
    if (word.length < 4) continue; // Skip very short words

    for (const prefix of prefixes) {
      const cleanPrefix = prefix.replace(/[-\/]/g, '');
      if (word.startsWith(cleanPrefix) && word.length > cleanPrefix.length + 2) {
        const key = `prefix:${cleanPrefix}:${word}`;
        if (!foundWords.has(key)) {
          foundWords.add(key);
          count++;
          console.log(`Found prefix usage: "${word}" (prefix: ${prefix})`);
        }
        break; // Only count one prefix per word
      }
    }

    // Check for suffix usage
    for (const suffix of suffixes) {
      const cleanSuffix = suffix.replace(/[-\/]/g, '');
      if (word.endsWith(cleanSuffix) && word.length > cleanSuffix.length + 2) {
        const key = `suffix:${cleanSuffix}:${word}`;
        if (!foundWords.has(key)) {
          foundWords.add(key);
          count++;
          console.log(`Found suffix usage: "${word}" (suffix: ${suffix})`);
        }
        break; // Only count one suffix per word
      }
    }
  }

  console.log(`Backup vocabulary count: ${count} items found`);
  return count;
}

/**
 * Backup class vocabulary identification function
 * Identifies actual vocabulary words used from class profile vocabulary list
 */
function identifyClassVocabulary(studentText, vocabulary) {
  if (!vocabulary || vocabulary.length === 0) {
    return [];
  }

  const text = studentText.toLowerCase();
  const foundVocab = [];
  const foundWords = new Set(); // Avoid duplicates

  for (const vocabItem of vocabulary) {
    const item = vocabItem.toLowerCase().trim();

    // Skip metadata entries
    if (item.includes('prefix') || item.includes('suffix') || item.includes('(any word')) {
      continue;
    }

    // Check for exact word/phrase matches
    if (item.includes(' ')) {
      // Multi-word phrases
      if (text.includes(item) && !foundWords.has(item)) {
        foundWords.add(item);
        foundVocab.push(vocabItem); // Use original case
        console.log(`Found class vocabulary phrase: "${vocabItem}"`);
      }
    } else {
      // Single words - check for word boundaries
      const escapedItem = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordRegex = new RegExp(`\\b${escapedItem}\\b`, 'gi');
      if (wordRegex.test(text) && !foundWords.has(item)) {
        foundWords.add(item);
        foundVocab.push(vocabItem); // Use original case
        console.log(`Found class vocabulary word: "${vocabItem}"`);
      }
    }
  }

  console.log(`Backup class vocabulary identification: ${foundVocab.length} items found`);
  return foundVocab;
}

/**
 * Backup transition words counting function
 * Counts transition words and phrases in student text
 */
function countTransitionWords(studentText) {
  // Common transition words and phrases
  const transitions = [
    // Addition
    'also', 'and', 'furthermore', 'moreover', 'in addition', 'additionally', 'besides', 'plus', 'too', 'as well', 'again', 'further', 'another', 'equally important', 'along with', 'together with',
    // Contrast
    'but', 'however', 'although', 'though', 'nevertheless', 'nonetheless', 'on the other hand', 'in contrast', 'while', 'whereas', 'yet', 'still', 'despite', 'in spite of', 'even though', 'rather', 'instead', 'alternatively', 'on the contrary', 'unlike', 'different from', 'otherwise',
    // Cause and Effect
    'because', 'since', 'as a result', 'therefore', 'thus', 'consequently', 'so', 'hence', 'due to', 'for this reason', 'as a consequence', 'accordingly', 'owing to', 'thanks to', 'because of', 'leads to', 'results in', 'causes', 'brings about',
    // Time/Sequence
    'first', 'second', 'third', 'firstly', 'secondly', 'thirdly', 'then', 'next', 'after', 'before', 'finally', 'lastly', 'meanwhile', 'subsequently', 'afterwards', 'later', 'earlier', 'previously', 'initially', 'at first', 'in the beginning', 'to begin with', 'during', 'while', 'until', 'when', 'once', 'as soon as', 'immediately', 'eventually', 'in the end', 'at last', 'in the meantime',
    // Example
    'for example', 'for instance', 'such as', 'namely', 'in particular', 'specifically', 'to illustrate', 'as an example', 'like', 'including', 'especially', 'particularly', 'that is', 'in other words',
    // Conclusion
    'in conclusion', 'to conclude', 'in summary', 'to summarize', 'overall', 'all in all', 'ultimately', 'in short', 'briefly', 'to sum up', 'on the whole', 'as I have shown', 'as can be seen', 'evidently', 'clearly', 'obviously', 'undoubtedly',
    // Emphasis
    'indeed', 'certainly', 'surely', 'of course', 'obviously', 'in fact', 'actually', 'really', 'truly', 'definitely', 'absolutely', 'without doubt', 'undoubtedly', 'clearly', 'evidently',
    // Clarification
    'that is', 'in other words', 'namely', 'specifically', 'to put it differently', 'to clarify', 'what I mean is'
  ];

  const text = studentText.toLowerCase();
  const foundTransitions = [];
  const foundWords = new Set(); // Avoid duplicates

  for (const transition of transitions) {
    // Check for exact matches with word boundaries
    const escapedTransition = transition.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedTransition}\\b`, 'gi');
    const matches = text.match(regex);

    if (matches && !foundWords.has(transition)) {
      foundWords.add(transition);
      foundTransitions.push(transition);
      console.log(`Found transition: "${transition}"`);
    }
  }

  console.log(`Backup transition count: ${foundTransitions.length} items found`);
  return foundTransitions;
}

/**
 * Backup grammar structure identification function
 * Identifies grammar structures used in student text
 */
function identifyGrammarStructures(studentText, grammarStructures) {
  if (!grammarStructures || grammarStructures.length === 0) {
    return [];
  }

  const text = studentText.toLowerCase();
  const foundStructures = [];
  const foundPatterns = new Set(); // Avoid duplicates

  // Grammar structure patterns and their indicators
  const grammarPatterns = {
    'Present Perfect': [
      /\b(?:have|has)\s+(?:been|gone|done|seen|made|taken|given|written|read|eaten|drunk|spoken|heard|felt|thought|known|found|lost|won|left|met|brought|bought|sold|taught|learned|worked|lived|traveled|played|studied|finished|started|helped|asked|answered|called|visited|watched|listened|looked|walked|run|come|become|got|gotten)\b/gi,
      /\b(?:have|has)\s+\w+ed\b/gi,
      /\b(?:have|has)\s+never\b/gi,
      /\b(?:have|has)\s+already\b/gi,
      /\b(?:have|has)\s+just\b/gi,
      /\b(?:have|has)\s+ever\b/gi,
      /\b(?:have|has)\s+recently\b/gi
    ],
    'Past Simple': [
      /\b(?:yesterday|last\s+\w+|ago)\b/gi,
      /\b\w+ed\s+(?:yesterday|last|ago)\b/gi,
      /\bwas\s+born\b/gi,
      /\bwent\s+to\b/gi,
      /\bcame\s+(?:home|back)\b/gi,
      /\bsaw\s+\w+\b/gi,
      /\bmade\s+\w+\b/gi,
      /\btook\s+\w+\b/gi,
      /\bgave\s+\w+\b/gi,
      /\bwrote\s+\w+\b/gi,
      /\bread\s+\w+\b/gi,
      /\bate\s+\w+\b/gi,
      /\bdrank\s+\w+\b/gi,
      /\bspoke\s+\w+\b/gi,
      /\bheard\s+\w+\b/gi,
      /\bfelt\s+\w+\b/gi,
      /\bthought\s+\w+\b/gi,
      /\bknew\s+\w+\b/gi,
      /\bfound\s+\w+\b/gi,
      /\blost\s+\w+\b/gi,
      /\bwon\s+\w+\b/gi,
      /\bleft\s+\w+\b/gi,
      /\bmet\s+\w+\b/gi,
      /\bbrought\s+\w+\b/gi,
      /\bbought\s+\w+\b/gi,
      /\bsold\s+\w+\b/gi,
      /\btaught\s+\w+\b/gi,
      /\blearned\s+\w+\b/gi,
      /\bworked\s+\w+\b/gi,
      /\blived\s+\w+\b/gi,
      /\btraveled\s+\w+\b/gi,
      /\bplayed\s+\w+\b/gi,
      /\bstudied\s+\w+\b/gi,
      /\bfinished\s+\w+\b/gi,
      /\bstarted\s+\w+\b/gi,
      /\bhelped\s+\w+\b/gi,
      /\basked\s+\w+\b/gi,
      /\banswered\s+\w+\b/gi,
      /\bcalled\s+\w+\b/gi,
      /\bvisited\s+\w+\b/gi,
      /\bwatched\s+\w+\b/gi,
      /\blistened\s+\w+\b/gi,
      /\blooked\s+\w+\b/gi,
      /\bwalked\s+\w+\b/gi
    ],
    'Present Continuous': [
      /\b(?:am|is|are)\s+\w+ing\b/gi,
      /\b(?:am|is|are)\s+(?:not\s+)?\w+ing\b/gi,
      /\bright\s+now\b/gi,
      /\bat\s+the\s+moment\b/gi,
      /\bcurrently\b/gi
    ],
    'Past Continuous': [
      /\b(?:was|were)\s+\w+ing\b/gi,
      /\bwhile\s+(?:was|were)\s+\w+ing\b/gi,
      /\bwhen\s+(?:was|were)\s+\w+ing\b/gi
    ],
    'Future Simple': [
      /\bwill\s+\w+\b/gi,
      /\bwon't\s+\w+\b/gi,
      /\bshall\s+\w+\b/gi,
      /\btomorrow\b/gi,
      /\bnext\s+\w+\b/gi,
      /\bin\s+the\s+future\b/gi,
      /\bsoon\b/gi
    ],
    'Going to Future': [
      /\b(?:am|is|are)\s+going\s+to\s+\w+\b/gi,
      /\b(?:am|is|are)\s+gonna\s+\w+\b/gi
    ],
    'First Conditional': [
      /\bif\s+\w+.*will\s+\w+\b/gi,
      /\bif\s+(?:you|I|we|they|he|she|it)\s+\w+.*will\b/gi,
      /\bunless\s+\w+.*will\s+\w+\b/gi
    ],
    'Second Conditional': [
      /\bif\s+\w+.*would\s+\w+\b/gi,
      /\bif\s+(?:I|you|we|they|he|she|it)\s+(?:was|were|had|could|would)\s+.*would\b/gi,
      /\bif\s+I\s+were\b/gi,
      /\bif\s+he\s+were\b/gi,
      /\bif\s+she\s+were\b/gi
    ],
    'Third Conditional': [
      /\bif\s+\w+\s+had\s+\w+.*would\s+have\s+\w+\b/gi,
      /\bif\s+(?:I|you|we|they|he|she|it)\s+had\s+\w+.*would\s+have\b/gi
    ],
    'Passive Voice': [
      /\b(?:am|is|are|was|were|will\s+be|have\s+been|has\s+been|had\s+been)\s+\w+ed\b/gi,
      /\b(?:am|is|are|was|were|will\s+be|have\s+been|has\s+been|had\s+been)\s+(?:made|done|seen|given|taken|written|read|eaten|drunk|spoken|heard|felt|thought|known|found|lost|won|left|met|brought|bought|sold|taught|learned|built|broken|chosen|driven|forgotten|gotten|held|kept|paid|run|sent|shown|told|understood|worn)\b/gi
    ],
    'Modal Verbs': [
      /\b(?:can|could|may|might|must|should|would|will|shall|ought\s+to|have\s+to|need\s+to|be\s+able\s+to)\s+\w+\b/gi,
      /\b(?:can't|couldn't|won't|wouldn't|shouldn't|mustn't|might\s+not|may\s+not)\s+\w+\b/gi
    ],
    'Relative Clauses': [
      /\b\w+\s+(?:who|which|that|whose|where|when)\s+\w+\b/gi,
      /\bthe\s+\w+\s+(?:who|which|that)\s+\w+\b/gi,
      /\ba\s+\w+\s+(?:who|which|that)\s+\w+\b/gi
    ],
    'Reported Speech': [
      /\b(?:said|told|asked|explained|mentioned|reported|announced|declared|stated|claimed|insisted|suggested|admitted|denied|promised|warned|advised|ordered|requested|begged|pleaded)\s+(?:that\s+)?\w+\b/gi,
      /\bhe\s+said\s+(?:that\s+)?\w+\b/gi,
      /\bshe\s+told\s+me\s+(?:that\s+)?\w+\b/gi
    ],
    'Comparative': [
      /\b\w+er\s+than\b/gi,
      /\bmore\s+\w+\s+than\b/gi,
      /\bless\s+\w+\s+than\b/gi,
      /\bbetter\s+than\b/gi,
      /\bworse\s+than\b/gi,
      /\bfaster\s+than\b/gi,
      /\bslower\s+than\b/gi,
      /\bbigger\s+than\b/gi,
      /\bsmaller\s+than\b/gi
    ],
    'Superlative': [
      /\bthe\s+\w+est\b/gi,
      /\bthe\s+most\s+\w+\b/gi,
      /\bthe\s+least\s+\w+\b/gi,
      /\bthe\s+best\b/gi,
      /\bthe\s+worst\b/gi,
      /\bthe\s+fastest\b/gi,
      /\bthe\s+slowest\b/gi,
      /\bthe\s+biggest\b/gi,
      /\bthe\s+smallest\b/gi
    ],
    'Gerunds': [
      /\b(?:enjoy|like|love|hate|dislike|prefer|mind|avoid|finish|stop|start|begin|continue|keep|suggest|recommend|practice|consider|imagine|admit|deny|risk|fancy|feel\s+like)\s+\w+ing\b/gi,
      /\b\w+ing\s+is\s+\w+\b/gi,
      /\bby\s+\w+ing\b/gi,
      /\bafter\s+\w+ing\b/gi,
      /\bbefore\s+\w+ing\b/gi,
      /\bwithout\s+\w+ing\b/gi
    ],
    'Infinitives': [
      /\bto\s+\w+\b/gi,
      /\b(?:want|need|plan|hope|expect|promise|decide|agree|refuse|offer|ask|tell|remind|warn|advise|encourage|persuade|force|allow|help|teach|learn)\s+(?:\w+\s+)?to\s+\w+\b/gi,
      /\bit's\s+\w+\s+to\s+\w+\b/gi,
      /\bin\s+order\s+to\s+\w+\b/gi
    ],
    'Question Tags': [
      /\b\w+.*,\s+(?:isn't|aren't|wasn't|weren't|doesn't|don't|didn't|won't|wouldn't|can't|couldn't|shouldn't|mustn't)\s+(?:it|he|she|they|you|we)\s*\?/gi,
      /\b\w+.*,\s+(?:is|are|was|were|does|do|did|will|would|can|could|should|must)\s+(?:it|he|she|they|you|we)\s*\?/gi
    ]
  };

  // Check each grammar structure
  for (const [structureName, patterns] of Object.entries(grammarPatterns)) {
    // Only check structures that are in the class profile
    if (!grammarStructures.includes(structureName)) {
      continue;
    }

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches && !foundPatterns.has(structureName)) {
        foundPatterns.add(structureName);
        foundStructures.push(structureName);
        console.log(`Found grammar structure: "${structureName}" (matched: "${matches[0]}")`);
        break; // Only count each structure once
      }
    }
  }

  console.log(`Backup grammar structure identification: ${foundStructures.length} structures found`);
  return foundStructures;
}

/**
 * Reset essay counter (useful for testing or new sessions)
 */
export function resetEssayCounter() {
  essayProcessedCount = 0;
  lastCoolingPeriod = 0;
  console.log('🔄 Essay counter reset for new session');
}

/**
 * Get current essay processing stats
 */
export function getProcessingStats() {
  return {
    essaysProcessed: essayProcessedCount,
    currentBatchPosition: ((essayProcessedCount - 1) % ESSAYS_PER_BATCH) + 1,
    essaysUntilCooling: ESSAYS_PER_BATCH - ((essayProcessedCount - 1) % ESSAYS_PER_BATCH) - 1,
    timeSinceLastCooling: Date.now() - lastCoolingPeriod
  };
}

// Export functions for testing
export { countVocabularyUsage, identifyClassVocabulary, countTransitionWords, identifyGrammarStructures };