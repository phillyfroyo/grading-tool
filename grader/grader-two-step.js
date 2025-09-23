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
  console.log('DEBUG: classProfileId received:', classProfileId);
  console.log('DEBUG: classProfileId type:', typeof classProfileId);
  console.log('FORCING NODEMON RESTART');
  
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
  
  // STEP 2: RUBRIC-BASED GRADING
  console.log('\n=== STEP 2: GRADING ===');
  const gradingResults = await gradeBasedOnRubric(studentText, classProfile, cefrLevel, errorDetectionResults);
  
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
  console.log('RAW RESPONSE LENGTH:', content?.length);
  console.log('RAW RESPONSE PREVIEW:', content?.substring(0, 500));
  console.log('FULL RAW RESPONSE:');
  console.log(content);
  console.log('=== END RAW RESPONSE ===');
  
  try {
    // Clean JSON - remove markdown code blocks
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(content);
    
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
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o", 
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Grade this essay based on the detected errors and rubric.` }
    ],
    temperature: 0.2, // Lower for consistent grading
  });

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
          explanation: `Collocation error: "${col.wrong}" should be "${col.correct}"`
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
        category: "mechanics-punctuation",
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
          explanation: `Misspelling: "${error.wrong}" should be "${error.correct}"`
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
        explanation: "Modal 'can' cannot follow 'to' - use 'be able to' instead"
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
        explanation: `Modal '${modal}' doesn't need 'to' after it`
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
        explanation: "Modal 'can' cannot follow 'to' - use 'be able to' instead"
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
        explanation: "Consider using 'very' or 'so' instead of 'too' when not expressing excess"
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

    // Special handling for mechanics-punctuation - be extra strict
    const isMechanics = category.includes('mechanics') || category.includes('punctuation');
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
      explanation: originalIssue.explanation || `Word choice issue with "${keyWord}"`,
      _split_from_group: true,
      _original_span: spanText,
      _original_category: originalCategory
    }];
  }

  return []; // Couldn't split intelligently
}

function generateExplanation(category, errorText, correction) {
  switch (category) {
    case 'spelling':
      return `Misspelling: "${errorText}" should be "${correction}"`;
    case 'grammar':
      return `Grammar error: "${errorText}" should be "${correction}"`;
    case 'mechanics':
      return `Mechanics error: "${errorText}" should be "${correction}"`;
    default:
      return `Error: "${errorText}" should be "${correction}"`;
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
      explanation: "We don't 'have' circle backs. Use 'circle back about' or 'circle back on' what was discussed"
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
      explanation: "'Drop questions' is unusual - typically we 'ask questions' or 'address questions'"
    },
    {
      wrong: /\bteamwork\s+have\b/gi,
      wrongPhrase: "teamwork have",
      correction: "team has",
      explanation: "Use 'team' (countable) when referring to people, not 'teamwork' (uncountable concept)"
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
      explanation: "Use 'do homework', not 'make homework'"
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
      explanation: "Use 'make a mistake', not 'do a mistake'"
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