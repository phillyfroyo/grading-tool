// grader/grader-hybrid.js
// HYBRID 4-STEP GRADING PROCESS: Dual Detection → Reconciliation → Metrics → Grading

import OpenAI from "openai";
import dotenv from "dotenv";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildConservativeErrorDetectionPrompt } from './error-detection-conservative.js';
import { buildThoroughErrorDetectionPrompt } from './error-detection-thorough.js';
import { buildErrorReconciliationPrompt } from './error-reconciliation.js';
import { buildMetricsPrompt } from './metrics-prompt.js';
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

// Queue management (same as original)
let requestQueue = [];
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 3;
const BASE_DELAY_BETWEEN_REQUESTS = 1000;

// Token rate limiting
let tokenUsageWindow = [];
const TOKENS_PER_MINUTE_LIMIT = 30000;
const WINDOW_SIZE_MS = 60000;
const SAFETY_BUFFER = 0.85;

// Batch processing tracking
let essayProcessedCount = 0;
const ESSAYS_PER_BATCH = 999;
const COOLING_PERIOD_MS = 0;
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

      if (error.status === 429 || error.message?.includes('Rate limit') || error.message?.includes('429')) {
        console.log(`🔄 Rate limit hit on attempt ${attempt + 1}/${maxRetries + 1}`);

        if (attempt < maxRetries) {
          let retryDelay = baseDelay * Math.pow(2, attempt);

          const delayMatch = error.message?.match(/try again in ([\d.]+)s/);
          if (delayMatch) {
            retryDelay = Math.max(retryDelay, parseFloat(delayMatch[1]) * 1000 + 500);
          }

          console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
      }

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
  tokenUsageWindow = tokenUsageWindow.filter(entry =>
    now - entry.timestamp < WINDOW_SIZE_MS
  );
}

/**
 * Calculate current token usage
 */
function getCurrentTokenUsage() {
  const now = Date.now();
  const recentUsage = tokenUsageWindow.filter(entry =>
    now - entry.timestamp < WINDOW_SIZE_MS
  );
  return recentUsage.reduce((total, entry) => total + entry.tokens, 0);
}

/**
 * Calculate dynamic delay based on token usage
 */
function calculateDynamicDelay(estimatedTokens = 3000) {
  const currentUsage = getCurrentTokenUsage();
  const safeLimit = TOKENS_PER_MINUTE_LIMIT * SAFETY_BUFFER;
  const remainingCapacity = safeLimit - currentUsage;

  console.log(`🔍 Token usage check: ${currentUsage}/${safeLimit} tokens used (${Math.round(currentUsage/safeLimit*100)}%)`);

  if (remainingCapacity < estimatedTokens) {
    const excessTokens = estimatedTokens - remainingCapacity;
    const delayForTokens = Math.ceil((excessTokens / safeLimit) * WINDOW_SIZE_MS);
    const totalDelay = Math.max(BASE_DELAY_BETWEEN_REQUESTS, delayForTokens);

    console.log(`⚠️ Token capacity low! Need ${estimatedTokens} tokens, only ${remainingCapacity} available. Adding ${totalDelay}ms delay.`);
    return totalDelay;
  }

  return BASE_DELAY_BETWEEN_REQUESTS;
}

/**
 * Queue-based OpenAI API call
 */
async function queuedOpenAICall(apiCall, estimatedTokens = 3000) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ apiCall, resolve, reject, estimatedTokens });
    processQueue();
  });
}

async function processQueue() {
  while (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
    const { apiCall, resolve, reject, estimatedTokens } = requestQueue.shift();

    activeRequests++;
    console.log(`📋 Starting request (${activeRequests}/${MAX_CONCURRENT_REQUESTS} active, ${requestQueue.length} queued)`);

    (async () => {
      try {
        const currentUsage = getCurrentTokenUsage();
        const safeLimit = TOKENS_PER_MINUTE_LIMIT * SAFETY_BUFFER;
        const remainingCapacity = safeLimit - currentUsage;

        if (remainingCapacity < estimatedTokens) {
          const delayNeeded = calculateDynamicDelay(estimatedTokens);
          console.log(`⏳ Waiting ${delayNeeded}ms for token capacity before processing...`);
          await new Promise(r => setTimeout(r, delayNeeded));
        }

        console.log(`🚀 Processing request (${activeRequests} active)`);
        const startTime = Date.now();
        const result = await retryWithBackoff(apiCall);
        const duration = Date.now() - startTime;

        const actualTokens = result.usage?.total_tokens || estimatedTokens;
        trackTokenUsage(actualTokens);

        console.log(`✅ Request completed in ${duration}ms (${actualTokens} tokens used, ${activeRequests - 1} active after completion)`);
        resolve(result);
      } catch (error) {
        console.error('❌ Queued request failed:', error.message);
        reject(error);
      } finally {
        activeRequests--;
        await new Promise(r => setTimeout(r, BASE_DELAY_BETWEEN_REQUESTS));
        processQueue();
      }
    })();
  }
}

/**
 * MAIN GRADING FUNCTION - HYBRID 4-STEP APPROACH
 */
export async function gradeEssay(studentText, prompt, classProfileId, studentNickname) {
  // Cooling period check (same as original)
  if (essayProcessedCount > 0 && essayProcessedCount % ESSAYS_PER_BATCH === 0) {
    const now = Date.now();
    const timeSinceLastCooling = now - lastCoolingPeriod;

    if (timeSinceLastCooling > COOLING_PERIOD_MS) {
      console.log(`🧊 COOLING PERIOD: Completed batch of ${ESSAYS_PER_BATCH} essays. Waiting ${COOLING_PERIOD_MS/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, COOLING_PERIOD_MS));
      lastCoolingPeriod = Date.now();
      console.log(`✅ Cooling period complete. Resuming processing...`);
    }
  }

  essayProcessedCount++;

  console.log('=== STARTING HYBRID 4-STEP GRADING PROCESS ===');
  console.log(`📊 Processing essay #${essayProcessedCount}`);
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

  // STEP 1A + 1B: DUAL ERROR DETECTION (PARALLEL)
  console.log('\n=== STEP 1: DUAL ERROR DETECTION (PARALLEL) ===');
  const [conservativeResults, thoroughResults] = await Promise.all([
    detectErrorsConservative(studentText, classProfile),
    detectErrorsThorough(studentText, classProfile)
  ]);

  console.log(`Conservative detection: ${conservativeResults.inline_issues.length} errors`);
  console.log(`Thorough detection: ${thoroughResults.inline_issues.length} errors`);

  // STEP 2: RECONCILIATION
  console.log('\n=== STEP 2: ERROR RECONCILIATION ===');
  const reconciliationResults = await reconcileErrors(studentText, conservativeResults.inline_issues, thoroughResults.inline_issues);

  console.log(`Final verified errors: ${reconciliationResults.final_errors.length}`);
  console.log(`Consensus errors: ${reconciliationResults.consensus_errors.length}`);
  console.log(`Additional verified: ${reconciliationResults.verified_additional.length}`);
  console.log(`False positives removed: ${reconciliationResults.removed_false_positives.length}`);
  console.log(`Span fixes made: ${reconciliationResults.span_fixes_made.length}`);

  // STEP 3: METRICS COUNTING
  console.log('\n=== STEP 3: DETERMINISTIC METRICS COUNTING ===');
  const metricsResults = await countMetrics(studentText, classProfile);

  console.log(`Metrics: ${metricsResults.word_count} words, ${metricsResults.vocabulary_count} vocab items, ${metricsResults.transition_words_found.length} transitions`);

  // STEP 4: GRADING
  console.log('\n=== STEP 4: RUBRIC-BASED GRADING ===');

  // Prepare error detection results format for grading prompt
  const errorDetectionForGrading = {
    inline_issues: reconciliationResults.final_errors,
    vocabulary_count: metricsResults.vocabulary_count,
    class_vocabulary_used: metricsResults.class_vocabulary_used,
    grammar_structures_used: metricsResults.grammar_structures_used,
    transition_words_found: metricsResults.transition_words_found
  };

  const gradingResults = await gradeBasedOnRubric(studentText, classProfile, cefrLevel, errorDetectionForGrading, studentNickname);

  // STEP 5: COMBINE RESULTS
  console.log('\n=== STEP 5: COMBINING RESULTS ===');

  const finalResults = {
    ...gradingResults,
    inline_issues: reconciliationResults.final_errors,
    corrected_text_minimal: reconciliationResults.corrected_text_minimal,
    meta: {
      word_count: metricsResults.word_count,
      paragraph_count: metricsResults.paragraph_count,
      sentence_count: metricsResults.sentence_count,
      vocabulary_count: metricsResults.vocabulary_count,
      vocabulary_used: metricsResults.vocabulary_used,
      class_vocabulary_used: metricsResults.class_vocabulary_used,
      grammar_structures_used: metricsResults.grammar_structures_used,
      transition_words_found: metricsResults.transition_words_found
    },
    debug: {
      conservative_errors: conservativeResults.inline_issues.length,
      thorough_errors: thoroughResults.inline_issues.length,
      consensus_errors: reconciliationResults.consensus_errors.length,
      verified_additional: reconciliationResults.verified_additional.length,
      false_positives_removed: reconciliationResults.removed_false_positives.length,
      span_fixes_made: reconciliationResults.span_fixes_made.length
    }
  };

  console.log(`Final combined results: ${finalResults.inline_issues.length} errors, ${finalResults.total.points}/${finalResults.total.out_of} points`);
  return finalResults;
}

/**
 * STEP 1A: Conservative error detection
 */
async function detectErrorsConservative(studentText, classProfile) {
  const prompt = buildConservativeErrorDetectionPrompt(classProfile, studentText);

  console.log('Calling GPT for CONSERVATIVE error detection...');

  const estimatedTokens = Math.ceil((prompt.length + studentText.length) * 0.75) + 1500;

  const response = await queuedOpenAICall(() => openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Analyze this text for OBVIOUS errors only: "${studentText}"` }
    ],
    temperature: 0.1, // Low temperature for conservative, consistent detection
  }), estimatedTokens);

  let content = response.choices[0].message.content;
  content = cleanJSONResponse(content);

  const result = JSON.parse(content);
  console.log(`Conservative detector found ${result.inline_issues.length} high-confidence errors`);

  return result;
}

/**
 * STEP 1B: Thorough error detection
 */
async function detectErrorsThorough(studentText, classProfile) {
  const prompt = buildThoroughErrorDetectionPrompt(classProfile, studentText);

  console.log('Calling GPT for THOROUGH error detection...');

  const estimatedTokens = Math.ceil((prompt.length + studentText.length) * 0.75) + 1500;

  const response = await queuedOpenAICall(() => openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Analyze this text for ALL errors (obvious and subtle): "${studentText}"` }
    ],
    temperature: 0.4, // Higher temperature for creative, thorough detection
  }), estimatedTokens);

  let content = response.choices[0].message.content;
  content = cleanJSONResponse(content);

  const result = JSON.parse(content);
  console.log(`Thorough detector found ${result.inline_issues.length} total potential errors`);

  return result;
}

/**
 * STEP 2: Reconcile and verify errors
 */
async function reconcileErrors(studentText, conservativeErrors, thoroughErrors) {
  const prompt = buildErrorReconciliationPrompt(studentText, conservativeErrors, thoroughErrors);

  console.log('Calling GPT for error reconciliation and verification...');

  const estimatedTokens = Math.ceil(prompt.length * 0.75) + 2000;

  const response = await queuedOpenAICall(() => openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Reconcile and verify the error lists, ensuring high quality spans and notes.` }
    ],
    temperature: 0.1, // Low temperature for consistent, deterministic reconciliation
  }), estimatedTokens);

  let content = response.choices[0].message.content;
  content = cleanJSONResponse(content);

  const result = JSON.parse(content);
  console.log(`Reconciliation complete: ${result.final_errors.length} verified errors`);

  return result;
}

/**
 * STEP 3: Count metrics deterministically
 */
async function countMetrics(studentText, classProfile) {
  const prompt = buildMetricsPrompt(classProfile, studentText);

  console.log('Calling GPT for deterministic metrics counting...');

  const estimatedTokens = Math.ceil(prompt.length * 0.75) + 1000;

  const response = await queuedOpenAICall(() => openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Count all requested metrics objectively.` }
    ],
    temperature: 0.1, // Very low temperature for deterministic counting
  }), estimatedTokens);

  let content = response.choices[0].message.content;
  content = cleanJSONResponse(content);

  const result = JSON.parse(content);
  console.log(`Metrics counted: ${result.word_count} words, ${result.vocabulary_count} vocab, ${result.transition_words_found.length} transitions`);

  return result;
}

/**
 * STEP 4: Grade based on rubric (same as original)
 */
async function gradeBasedOnRubric(studentText, classProfile, cefrLevel, errorDetectionResults, studentNickname) {
  const prompt = buildGradingPrompt(rubric, classProfile, cefrLevel, studentText, errorDetectionResults, studentNickname);

  console.log('Calling GPT for rubric-based grading...');
  console.log(`Errors to consider: ${errorDetectionResults.inline_issues.length} issues`);

  const gradingEstimatedTokens = Math.ceil((prompt.length + studentText.length) * 0.75) + 1000;

  const response = await queuedOpenAICall(() => openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Grade this essay based on the detected errors and rubric.` }
    ],
    temperature: 0.1, // Low temperature for consistent grading
  }), gradingEstimatedTokens);

  let content = response.choices[0].message.content;
  content = cleanJSONResponse(content);

  const result = JSON.parse(content);

  // Fix category names if needed
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

  return result;
}

/**
 * Clean JSON response (remove markdown, extract JSON)
 */
function cleanJSONResponse(content) {
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  const jsonStartIndex = content.indexOf('{');
  const jsonEndIndex = content.lastIndexOf('}');

  if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
    content = content.substring(jsonStartIndex, jsonEndIndex + 1);
  }

  return content;
}

// Export utility functions
export function resetEssayCounter() {
  essayProcessedCount = 0;
  lastCoolingPeriod = 0;
  console.log('🔄 Essay counter reset for new session');
}

export function getProcessingStats() {
  return {
    essaysProcessed: essayProcessedCount,
    currentBatchPosition: ((essayProcessedCount - 1) % ESSAYS_PER_BATCH) + 1,
    essaysUntilCooling: ESSAYS_PER_BATCH - ((essayProcessedCount - 1) % ESSAYS_PER_BATCH) - 1,
    timeSinceLastCooling: Date.now() - lastCoolingPeriod
  };
}

export function getCurrentEssayCount() {
  return essayProcessedCount;
}
