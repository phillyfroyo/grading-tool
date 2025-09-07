// grader/grader-two-step.js
// TWO-STEP GRADING PROCESS: Error Detection + Scoring

import OpenAI from "openai";
import dotenv from "dotenv";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildErrorDetectionPrompt } from './error-detection-prompt.js';
import { buildGradingPrompt } from './grading-prompt.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rubric = JSON.parse(readFileSync(join(__dirname, 'rubric.json'), 'utf8'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function gradeEssay(studentText, prompt, classProfileId) {
  console.log('=== STARTING TWO-STEP GRADING PROCESS ===');
  
  // Load class profile
  const profilesData = JSON.parse(readFileSync('./class-profiles.json', 'utf8'));
  const classProfile = profilesData.profiles.find(p => p.id === classProfileId);
  
  if (!classProfile) {
    throw new Error(`Class profile ${classProfileId} not found`);
  }
  
  const cefrLevel = classProfile.cefrLevel;
  console.log(`CEFR Level: ${cefrLevel}, Class Profile: ${classProfile.name}`);

  // STEP 1: AGGRESSIVE ERROR DETECTION
  console.log('\n=== STEP 1: ERROR DETECTION ===');
  const errorDetectionResults = await detectErrors(studentText, classProfile);
  
  // STEP 2: MERCIFUL GRADING  
  console.log('\n=== STEP 2: GRADING ===');
  const gradingResults = await gradeWithMercy(studentText, classProfile, cefrLevel, errorDetectionResults);
  
  // STEP 3: COMBINE RESULTS
  console.log('\n=== STEP 3: COMBINING RESULTS ===');
  const finalResults = {
    ...gradingResults,
    inline_issues: errorDetectionResults.inline_issues,
    corrected_text_minimal: errorDetectionResults.corrected_text_minimal,
    meta: {
      word_count: studentText.split(/\s+/).filter(word => word.length > 0).length,
      vocabulary_count: errorDetectionResults.vocabulary_count || 0,
      grammar_structures_used: errorDetectionResults.grammar_structures_used || []
    }
  };

  console.log(`Final combined results: ${finalResults.inline_issues.length} errors, ${finalResults.total.points}/${finalResults.total.out_of} points`);
  return finalResults;
}

async function detectErrors(studentText, classProfile) {
  const prompt = buildErrorDetectionPrompt(classProfile, studentText);
  
  console.log('Calling GPT for error detection...');
  console.log(`Student text (${studentText.length} chars): "${studentText.substring(0, 100)}..."`);
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Analyze this text for errors: "${studentText}"` }
    ],
    temperature: 0.5, // Higher for aggressive detection
  });

  console.log('=== RAW ERROR DETECTION RESPONSE ===');
  let content = response.choices[0].message.content;
  console.log(content);
  console.log('=== END RAW RESPONSE ===');
  
  try {
    // Clean JSON - remove markdown code blocks
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(content);
    
    // Apply safety net patches
    if (result.inline_issues) {
      console.log(`GPT found ${result.inline_issues.length} errors before patching`);
      
      result.inline_issues = patchHomeworkCollocations(studentText, result.inline_issues);
      result.inline_issues = patchCommonErrors(studentText, result.inline_issues);
      result.inline_issues = patchModalAndTooUsage(studentText, result.inline_issues);
      
      console.log(`After patching: ${result.inline_issues.length} total errors`);
    }
    
    return result;
  } catch (error) {
    console.error('Error parsing JSON from error detection:', error);
    throw new Error(`Failed to parse error detection response: ${error.message}`);
  }
}

async function gradeWithMercy(studentText, classProfile, cefrLevel, errorDetectionResults) {
  const prompt = buildGradingPrompt(rubric, classProfile, cefrLevel, studentText, errorDetectionResults);
  
  console.log('Calling GPT for merciful grading...');
  console.log(`Errors to consider: ${errorDetectionResults.inline_issues.length} issues`);
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o", 
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Grade this essay mercifully based on the detected errors and rubric.` }
    ],
    temperature: 0.2, // Lower for consistent grading
  });

  console.log('=== RAW GRADING RESPONSE ===');
  let content = response.choices[0].message.content;
  console.log(content);
  console.log('=== END RAW RESPONSE ===');
  
  try {
    // Clean JSON - remove markdown code blocks
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
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
          type: "vocabulary-structure",
          subtype: "collocation",
          message: `${col.wrong} → ${col.correct}`,
          offsets: { start: match.index, end: match.index + col.wrong.length }
        });
      }
    }
  }
  
  if (newIssues.length > 0) {
    console.log(`Added ${newIssues.length} homework collocation fixes:`, newIssues.map(i => i.message));
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
        type: "mechanics-punctuation",
        subtype: "capitalization",
        message: "i→I",
        offsets: { start: match.index + 1, end: match.index + 2 }
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
          type: "spelling",
          subtype: "misspelling",
          message: `${error.wrong}→${error.correct}`,
          offsets: { start: match.index, end: match.index + error.wrong.length }
        });
      }
    }
  }
  
  if (newIssues.length > 0) {
    console.log(`Added ${newIssues.length} missing common errors:`, newIssues.map(i => i.message));
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
        type: "grammar",
        subtype: "modal_usage",
        message: "to can → to be able to",
        offsets: { start, end }
      });
    }
  }

  // 2) 'must to' / 'should to' → 'must' / 'should'
  for (const m of text.matchAll(/\\b(must|should)\\s+to\\b/gi)) {
    const start = m.index, end = start + m[0].length;
    const modal = m[1].toLowerCase();
    if (!isAlreadyCovered(start, end, issues)) {
      newIssues.push({
        type: "grammar",
        subtype: "modal_usage",
        message: `${modal} to → ${modal}`,
        offsets: { start, end }
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
        type: "grammar",
        subtype: "modal_usage",
        message: "to can → to be able to",
        offsets: { start: canStart, end: canStart + 6 }
      });
    }

    // (b) 'too' choice (only when it doesn't express excess)
    if (!isAlreadyCovered(wholeStart, wholeEnd, issues)) {
      newIssues.push({
        type: "grammar",
        subtype: "word_choice",
        message: "too … (non-excess) → very/so …",
        offsets: { start: wholeStart, end: wholeEnd }
      });
    }
  }

  if (newIssues.length > 0) {
    console.log(`Added ${newIssues.length} modal/too usage errors:`, newIssues.map(i => i.message));
  }

  return [...issues, ...newIssues];
}

function isAlreadyCovered(start, end, existingIssues) {
  return existingIssues.some(issue => {
    if (!issue.offsets) return false;
    // Check for any overlap
    return !(start >= issue.offsets.end || end <= issue.offsets.start);
  });
}