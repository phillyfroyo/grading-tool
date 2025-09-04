// grader/grader.js
import OpenAI from "openai";
import dotenv from "dotenv";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rubric = JSON.parse(readFileSync(join(__dirname, 'rubric.json'), 'utf8'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function gradeEssay(studentText, prompt, classProfileId) {
  // Load class profile
  const profilesData = JSON.parse(readFileSync('./class-profiles.json', 'utf8'));
  const classProfile = profilesData.profiles.find(p => p.id === classProfileId);
  
  if (!classProfile) {
    throw new Error(`Class profile ${classProfileId} not found`);
  }
  
  const cefrLevel = classProfile.cefrLevel;
  const levelInfo = rubric.cefr_levels[cefrLevel] || rubric.cefr_levels['C1'];
  const categories = Object.keys(rubric.categories);
  
  const systemPrompt = `You are an expert ESL writing grader following university standards. 

CEFR Level: ${cefrLevel} (${levelInfo.name})
Strictness: ${levelInfo.description}

ZERO SCORE RULES (automatic 0 if any apply):
${rubric.zero_rules.map(rule => `- ${rule}`).join('\n')}

GRADING CATEGORIES (weights and bands):
${categories.map(cat => {
  const category = rubric.categories[cat];
  return `${category.name} (${category.weight}%):
${category.bands.map(band => `  ${band.range}: ${band.description}`).join('\n')}`;
}).join('\n\n')}

CLASS-SPECIFIC REQUIREMENTS:
- Target word count: ${rubric.layout_rules.target_word_count_min}-${rubric.layout_rules.target_word_count_max} words
- Minimum transition words: ${rubric.layout_rules.transition_words_min}

VOCABULARY TAUGHT IN CLASS (must be counted specifically):
${classProfile.vocabulary.join(', ')}

GRAMMAR STRUCTURES TAUGHT IN CLASS (must be identified and counted):
${classProfile.grammar.join(', ')}

IMPORTANT: Apply leniency_mode=easy for merciful but thorough grading:

LENIENCY RULES:
• Mark every error with gentle explanation and suggested fix
• Do not assign lowest band unless comprehension is impeded  
• Cap per-category deductions for frequent minor issues at -40% of category weight
• If word count within target ±25 words, don't drop Layout below middle band solely for transitions
• If no class vocabulary provided, don't penalize - evaluate natural variety instead
• Always include 2 positives before critical feedback in each category (praise-then-coach)
• Set soft floor of 60/100 unless comprehension broken, off-topic, or zero-rule triggered

COLLOCATION POLICY (must follow):
• Prefer idiomatic collocations over literal tense changes
• When meaning is "complete school assignments," use DO homework (past: did, -ing: doing, perfect: have/has done)
• NEVER output "make/made/making homework" when meaning is "complete assignments"
• For weekend recounts, assume past simple narrative unless context clearly says otherwise
• When you correct a collocation, emit inline_issue with type:"vocabulary", subtype:"collocation"
• Consult collocation preferences before changing verb tense; pick idiomatic form that matches detected tense

CRITICAL COVERAGE REQUIREMENT: 
• Every feedback item must also appear in inline_issues[] with correct {start, end} offsets
• This includes capitalization errors ('i' → 'I', 'friday' → 'Friday'), punctuation issues (missing commas), collocation problems ('pizzas for lunch'), and unnatural word order ('I could only eat')
• Do not mention a problem in rationales unless it is also marked inline
• If you suggest a fix like adding transitions ('afterward', 'finally'), these stay in rationales only, not in inline_issues[]

MANDATORY ERROR DETECTION (must catch ALL instances):
• Capitalization: every instance of lowercase "i" and day names (friday→Friday, saturday→Saturday, etc.)
• Punctuation: missing commas after introductory phrases ("on friday," "unfortunately," "then,")
• Prepositions: "to lunch" → "for lunch", "to dinner" → "for dinner"  
• Measurements: "2lts" → "2-liter", "1km" → "1 kilometer"
• Word order: "I only could eat" → "I could only eat", "I always go" → "I always go"
• Collocations: scan for ALL unnatural phrases, not just homework
• Articles: missing "the/a/an" where needed

FEEDBACK TEMPLATE per category:
• Category header: short praise first
• What to fix: 1-3 bullet items with examples  
• Micro-rewrite: rewrite one sentence correctly
• Why it helps: one sentence on clarity/impact

CRITICAL: Return ONLY valid JSON - no markdown, no code blocks, no extra text. Just pure JSON in this exact format:
{
  "meta": {
    "word_count": 109,
    "transition_words_found": ["then", "unfortunately", "also"],
    "class_vocabulary_used": ["stakeholder", "revenue"] OR "N/A (no list provided)",
    "grammar_structures_used": ["Present Perfect", "Conditionals"]
  },
  "scores": {
    "grammar": {"points": 11, "out_of": 15, "rationale": "Nice verb variety! Add past tense consistency: 'went' not 'go'. Try: 'Last Friday, I went to school early.' This makes the timeline clearer."},
    "vocabulary": {"points": 11, "out_of": 15, "rationale": "Good word choices! Use more descriptive words: 'interesting' → 'fascinating'. Try: 'The fascinating movie kept us engaged.' This adds more impact."},
    "spelling": {"points": 12, "out_of": 15, "rationale": "Mostly accurate spelling! Fix: 'wekend' → 'weekend'. Try: 'Last weekend was amazing.' This avoids confusion."},
    "mechanics": {"points": 10, "out_of": 15, "rationale": "Good sentence starts! Add periods to avoid run-ons: split long sentences. Try: 'I went home. Then I played games.' This makes ideas clearer."},
    "fluency": {"points": 7, "out_of": 10, "rationale": "Clear story flow! Connect ideas better with transitions: 'then, afterward, finally'. Try: 'First I studied, then I relaxed.' This guides the reader."},
    "layout": {"points": 12, "out_of": 15, "rationale": "Good length and structure! Add 2-3 more transitions for smooth flow. Try adding: 'moreover, however, in conclusion.' This improves readability."},
    "content": {"points": 13, "out_of": 15, "rationale": "Engaging personal story! Add more specific details: what games? which friends? Try: 'I played chess with my neighbor Tom.' This makes it more vivid."}
  },
  "total": {"points": 76, "out_of": 100, "band": "C+"},
  "inline_issues": [
    {"type": "spelling", "subtype": "misspelling", "message": "wekend→weekend", "offsets": {"start": 8, "end": 14}},
    {"type": "grammar", "subtype": "tense", "message": "go→went (past tense)", "offsets": {"start": 16, "end": 18}},
    {"type": "mechanics", "subtype": "run_on", "message": "Split into two sentences", "offsets": {"start": 55, "end": 86}}
  ],
  "teacher_notes": "Clear day-by-day story with good personal details. Nice effort on organization!",
  "encouragement_next_steps": [
    "Add 'then, after that, finally' to guide the reader through your story",
    "Change present verbs to past tense consistently (played, ordered, slept)",
    "Split very long sentences with periods for clarity"
  ]
}

Categories must be exactly: grammar, vocabulary, spelling, mechanics, fluency, layout, content

For ${cefrLevel} level, apply ${levelInfo.strictness_modifier}x strictness modifier (more lenient for B2).`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Assignment Prompt: ${prompt}

Student Text: ${studentText}

CRITICAL: You must identify EVERY SINGLE ERROR for color-coding. This is for teaching purposes.

STEP 1: ERROR DETECTION (Be thorough - find ALL errors):
- GRAMMAR: Every tense error, subject-verb disagreement, article mistake, preposition error
- SPELLING: Every misspelled word, including "wekend", "hole" (whole), etc.
- MECHANICS: Every missing comma, period, capitalization error
- VOCABULARY: Word choice issues, register problems
- CONTENT: Unclear or missing ideas  
- LAYOUT: Structure and transition issues

STEP 2: GRADING ANALYSIS:
1. Count total words and identify ALL transition words used
2. Identify and count vocabulary from class list: ${classProfile.vocabulary.join(', ')}
3. Identify and count grammar structures from class: ${classProfile.grammar.join(', ')}
4. Grade according to ${cefrLevel} expectations for ${classProfile.name}

IMPORTANT: For inline_issues, you must find ALL errors, not just examples. Students need to see every mistake highlighted for learning. Include tense errors like "rest" → "rested", "order" → "ordered", BUT check collocation preferences first.

COLLOCATION PREFERENCES:
{
  "homework_collocations": {
    "wrong": ["make homework", "made homework", "making homework"],
    "correct": {
      "base": "do homework", 
      "past": "did homework", 
      "ing": "doing homework", 
      "perfect": "have/has done homework"
    }
  }
}

CRITICAL: Consult collocation_preferences before changing verb tense. Pick the idiomatic form that matches the detected tense.

PAST TENSE CONTEXT DETECTION: If the essay contains past time markers ("past weekend", "on friday", "then", "yesterday", etc.) or past verbs ("came", "played", "woke"), assume past narrative context. For past context:
- "make my homework" → "did my homework" 
- "making my homework" → "was doing my homework"
- "make homework" → "did homework"

Be comprehensive in error detection but merciful in scoring.`,
      },
    ],
    temperature: 0.2,
  });

  try {
    let content = response.choices[0].message.content;
    
    // Remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const result = JSON.parse(content);
    
    // Safety net: Add missing common errors
    if (result.inline_issues) {
      result.inline_issues = patchHomeworkCollocations(studentText, result.inline_issues);
      result.inline_issues = patchCommonErrors(studentText, result.inline_issues);
    }
    
    // Debug: Log the inline issues to see what GPT is providing
    console.log("=== DEBUG: Student text ===");
    console.log(`"${studentText}"`);
    console.log("=== DEBUG: GPT inline_issues ===");
    if (result.inline_issues) {
      result.inline_issues.forEach((issue, index) => {
        const actualText = studentText.slice(issue.offsets.start, issue.offsets.end);
        console.log(`${index + 1}. ${issue.type}: "${actualText}" at ${issue.offsets.start}-${issue.offsets.end} (expected: "${issue.message.split('→')[0]}")`);
      });
    }
    
    // Apply CEFR level strictness modifier to scores (for new format)
    if (cefrLevel === 'B2' && result.scores) {
      Object.keys(result.scores).forEach(cat => {
        if (result.scores[cat].points) {
          result.scores[cat].points = Math.min(result.scores[cat].out_of, 
            Math.round(result.scores[cat].points * levelInfo.strictness_modifier));
        }
      });
      
      // Update total
      const totalPoints = Object.values(result.scores).reduce((sum, score) => sum + (score.points || 0), 0);
      result.total.points = totalPoints;
    }
    
    return result;
  } catch (error) {
    console.error("Failed to parse GPT response:", response.choices[0].message.content);
    throw new Error("Invalid JSON response from GPT");
  }
}

function patchHomeworkCollocations(text, issues) {
  const re = /\b(made|make|making)\s+(my\s+)?homework\b/gi;
  const matches = [...text.matchAll(re)];
  
  // Detect if this is past tense context
  const pastMarkers = /\b(past\s+weekend|yesterday|last\s+\w+|came|played|woke|went|did|was|were)\b/i;
  const isPastContext = pastMarkers.test(text);
  
  for (const match of matches) {
    const verb = match[1].toLowerCase();
    const fullMatch = match[0];
    
    // Context-aware suggestions
    let suggestion;
    if (isPastContext) {
      suggestion = verb === "making" ? "was doing my homework" : "did my homework";
    } else {
      suggestion = 
        verb === "made" ? "did homework" :
        verb === "making" ? "doing homework" : "do homework";
    }
    
    // Check if this error is already covered (more precise overlap detection)
    const alreadyCovered = issues.some(issue => {
      if (!issue.offsets) return false;
      
      // Check for any overlap, not just containment
      const hasOverlap = !(match.index >= issue.offsets.end || match.index + fullMatch.length <= issue.offsets.start);
      
      // Also check if it's the same type of error
      const sameType = (issue.type === "vocabulary" && issue.message && issue.message.includes("homework")) ||
                      (issue.message && issue.message.includes("make") && issue.message.includes("homework"));
      
      return hasOverlap && sameType;
    });
    
    if (!alreadyCovered) {
      console.log(`Adding missing homework collocation: "${fullMatch}" → "${suggestion}" (past context: ${isPastContext})`);
      issues.push({
        type: "vocabulary",
        subtype: "collocation", 
        message: `${fullMatch}→${suggestion}`,
        offsets: { 
          start: match.index, 
          end: match.index + fullMatch.length 
        }
      });
    } else {
      console.log(`Homework collocation already covered: "${fullMatch}"`);
    }
  }
  
  return issues;
}

function patchCommonErrors(text, issues) {
  const newIssues = [];
  
  // 1. Lowercase "i" (personal pronoun)
  const iRegex = /\b i \b/g;
  for (const match of text.matchAll(iRegex)) {
    if (!isAlreadyCovered(match.index + 1, match.index + 2, issues)) {
      newIssues.push({
        type: "mechanics",
        subtype: "capitalization",
        message: "i→I",
        offsets: { start: match.index + 1, end: match.index + 2 }
      });
    }
  }
  
  // 2. Lowercase day names
  const dayRegex = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
  for (const match of text.matchAll(dayRegex)) {
    const day = match[1];
    const properDay = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
    
    if (day !== properDay && !isAlreadyCovered(match.index, match.index + day.length, issues)) {
      newIssues.push({
        type: "mechanics",
        subtype: "capitalization", 
        message: `${day}→${properDay}`,
        offsets: { start: match.index, end: match.index + day.length }
      });
    }
  }
  
  // 3. Missing commas after introductory phrases
  const introRegex = /\b(on \w+|then|unfortunately|finally|however)\s+[A-Z]/g;
  for (const match of text.matchAll(introRegex)) {
    const phrase = match[0];
    const introWord = match[1];
    const commaPos = match.index + introWord.length;
    
    if (!phrase.includes(',') && !isAlreadyCovered(commaPos, commaPos + 1, issues)) {
      newIssues.push({
        type: "mechanics",
        subtype: "comma",
        message: `Add comma after "${introWord}"`,
        offsets: { start: commaPos, end: commaPos + 1 }
      });
    }
  }
  
  // 4. Preposition errors
  const prepRegex = /\b(pizzas|lunch|dinner|breakfast)\s+to\s+(lunch|dinner|breakfast|eat)\b/gi;
  for (const match of text.matchAll(prepRegex)) {
    const phrase = match[0];
    const corrected = phrase.replace(/\s+to\s+/, ' for ');
    if (!isAlreadyCovered(match.index, match.index + phrase.length, issues)) {
      newIssues.push({
        type: "grammar",
        subtype: "preposition",
        message: `${phrase}→${corrected}`,
        offsets: { start: match.index, end: match.index + phrase.length }
      });
    }
  }
  
  // 5. Measurement errors
  const measurementRegex = /\b(\d+)(lts?|kms?|hrs?)\b/gi;
  for (const match of text.matchAll(measurementRegex)) {
    const original = match[0];
    const number = match[1];
    const unit = match[2].toLowerCase();
    
    let corrected;
    if (unit.startsWith('lt')) corrected = `${number}-liter`;
    else if (unit.startsWith('km')) corrected = `${number} kilometer${number !== '1' ? 's' : ''}`;
    else if (unit.startsWith('hr')) corrected = `${number} hour${number !== '1' ? 's' : ''}`;
    
    if (corrected && !isAlreadyCovered(match.index, match.index + original.length, issues)) {
      newIssues.push({
        type: "spelling",
        subtype: "abbreviation",
        message: `${original}→${corrected}`,
        offsets: { start: match.index, end: match.index + original.length }
      });
    }
  }
  
  // 6. Word order errors
  const wordOrderRegex = /\bI\s+(only|always|never|usually)\s+(could|can|would|will)\b/gi;
  for (const match of text.matchAll(wordOrderRegex)) {
    const phrase = match[0];
    const adverb = match[1];
    const modal = match[2];
    const corrected = phrase.replace(new RegExp(`\\b${adverb}\\s+${modal}\\b`, 'i'), `${modal} ${adverb}`);
    
    if (!isAlreadyCovered(match.index, match.index + phrase.length, issues)) {
      newIssues.push({
        type: "grammar",
        subtype: "word_order",
        message: `${phrase}→${corrected}`,
        offsets: { start: match.index, end: match.index + phrase.length }
      });
    }
  }
  
  // 7. Common spelling errors we should catch
  const commonSpellingErrors = [
    { wrong: "wekend", correct: "weekend" },
    { wrong: "recieve", correct: "receive" },
    { wrong: "seperate", correct: "separate" },
    { wrong: "definately", correct: "definitely" },
    { wrong: "hole", correct: "whole", context: "soda|pizza|meal" } // "hole soda" → "whole soda"
  ];
  
  for (const error of commonSpellingErrors) {
    let regex;
    if (error.context) {
      regex = new RegExp(`\\b${error.wrong}\\s+(${error.context})\\b`, 'gi');
    } else {
      regex = new RegExp(`\\b${error.wrong}\\b`, 'gi');
    }
    
    for (const match of text.matchAll(regex)) {
      const matchText = error.context ? error.wrong : match[0];
      const correctedText = error.context ? match[0].replace(error.wrong, error.correct) : error.correct;
      const start = error.context ? match.index : match.index;
      const end = error.context ? match.index + error.wrong.length : match.index + matchText.length;
      
      if (!isAlreadyCovered(start, end, issues)) {
        newIssues.push({
          type: "spelling",
          subtype: "misspelling",
          message: `${matchText}→${correctedText}`,
          offsets: { start, end }
        });
      }
    }
  }
  
  if (newIssues.length > 0) {
    console.log(`Added ${newIssues.length} missing common errors:`, newIssues.map(i => i.message));
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
