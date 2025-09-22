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
  
  const systemPrompt = `You are an expert ESL writing grader with TWO SEPARATE RESPONSIBILITIES:

═══════════════════════════════════════════════════════════════════════════════
PART A: COLOR-CODED ESSAY MARKINGS (AGGRESSIVE ERROR DETECTION)
═══════════════════════════════════════════════════════════════════════════════

Be EXTREMELY AGGRESSIVE and comprehensive in error detection for the inline_issues array.

MARK EVERY SINGLE ISSUE including:
- Grammar errors (even minor ones)
- Awkward phrasing and unnatural expressions  
- Spelling mistakes
- Punctuation problems
- Vocabulary misuse
- Style issues
- Any deviation from natural English

MARKING POLICY:
- If unsure whether something is an error, MARK IT ANYWAY and explain why
- Do NOT consider mercy or leniency here - the goal is to TEACH and highlight, not to grade
- Mark borderline cases - err on the side of being too strict rather than missing errors
- This is like a teacher circling every mistake in red pen

CORRECTION GUIDE CATEGORIES (for inline_issues):
- "grammar" (subject-verb agreement, tenses, articles, etc.)
- "mechanics-punctuation" (punctuation, capitalization, run-on sentences)  
- "redundancy" (repetitive words/phrases)
- "vocabulary-structure" (word choice, collocations, awkward phrasing)
- "needs-rephrasing" (unclear sentences that need restructuring)
- "non-suitable-words" (inappropriate word choices)
- "spelling" (misspellings and typos)
- "fluency" (natural language coaching - coaching_only: true)
- "professor-comments" (general feedback)

═══════════════════════════════════════════════════════════════════════════════
PART B: CATEGORY SCORING (MERCIFUL GRADING)  
═══════════════════════════════════════════════════════════════════════════════

CEFR Level: ${cefrLevel} (${levelInfo.name})
Grading Approach: ${levelInfo.description}

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

GRAMMAR STRUCTURES TAUGHT IN CLASS (must be identified and counted BY OCCURRENCE):
${classProfile.grammar.join(', ')}
CRITICAL: Count EACH individual use, not just categories. If "Present Perfect" appears 3 times, report "Present Perfect: 3 occurrences"

CORRECTION DEPTH & POLICY:

Goal: mark all errors that fall into one of the correction guide categories. The corrections must be grammatical while remaining faithful to the student's meaning.

*"When deciding whether to mark something as grammar or fluency:

If it is ungrammatical → always grammar.

If it is grammatical but awkward → fluency (coaching_only).

If unsure → grammar."*

Always mark truly incorrect grammar

In the color-coded essay, mark phrases that use unnatural or awkward English without reducing the grade.

Keep the student's clause order unless ungrammatical.

No duplicate subjects or verbs. Never output patterns like "is a Interstellar is…".

Vocabulary changes (e.g., history → story) are allowed only after the sentence is grammatical. If a sentence remains awkward but correct, leave it and coach in the rationale.

Prefer atomic edits (replace/insert/delete short spans). Avoid adding new ideas.

Proper nouns must be capitalized (e.g., Interstellar, Christopher Nolan).

Sentence Repair Order (apply in this order, then stop):
1. Capitalization & punctuation (proper nouns, sentence starts)
2. Articles/determiners for singular count nouns (a/an/the)
3. Subject–verb agreement & basic tense
4. Word order for auxiliaries/adverbs (I could only…)
5. High-confidence vocabulary misuses (history → story)
6. Split run-ons only when necessary for grammar

SCORING LENIENCY RULES (PART B ONLY - DO NOT APPLY TO PART A MARKINGS):

• Do not assign lowest band unless comprehension is impeded  
• Cap per-category deductions for frequent minor issues at -40% of category weight
• If word count within target ±25 words, don't drop Layout below middle band solely for transitions
• If no class vocabulary provided, don't penalize - evaluate natural variety instead
• Try to include 2 positives before critical feedback in each category (praise-then-coach)
• Set soft floor of 80/100 unless comprehension broken, off-topic, or zero-rule triggered
• Be merciful and supportive in score assignment - even if many errors are marked in Part A

PERFECT PERFORMANCE RULE:
• If no errors are found in a category, award FULL POINTS (15/15 for most categories, 10/10 for spelling)
• Don't withhold points "just in case" - if performance is truly excellent, give excellent grades
• Only reduce points when you can identify specific, fixable issues

ERROR SEVERITY GUIDELINES:
• MINOR ERRORS (deduct 1-2 points max per category): capitalization of proper nouns, minor punctuation
• MODERATE ERRORS (deduct 2-4 points per category): word choice, some grammar structures
• MAJOR ERRORS (deduct 4+ points per category): comprehension-impeding mistakes, wrong tenses throughout
• For essays with only 1-2 minor errors total, minimum grade should be 90/100

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
• Duplicate verb/subject guard: If the input has "I think is X is…", correct to "I think X is…" (remove the extra "is")
• Article insertion guard: Before singular count nouns, insert a/an unless a determiner is already present or it's a proper noun/uncountable (Interstellar is a great movie)

FEEDBACK TEMPLATE per category:
• Use natural, conversational encouragement - avoid excessive exclamation marks
• Make praise feel genuine and specific, not formulaic
• Use varied language: "Nice work on...", "You're doing well with...", "Good progress on..."
• What to fix: 1-3 bullet items with examples  
• Micro-rewrite: rewrite one sentence correctly
• Why it helps: one sentence on clarity/impact

ENCOURAGEMENT TONE:
• Natural and conversational, not overly enthusiastic
• Specific to the actual work, not generic praise
• Use periods more than exclamation marks
• Vary your openings: "You're making progress with...", "Nice work on...", "Good use of..."

RANKING PROCESS:
1. Calculate all 7 scores first
2. Rank them: 1st highest, 2nd highest, 3rd highest, etc.
3. Apply encouragement ONLY to 1st and 2nd ranked categories
4. Write rationale for others WITHOUT any encouraging opening

CRITICAL: Return ONLY valid JSON - no markdown, no code blocks, no extra text. Just pure JSON in this exact format:
{
  "meta": {
    "word_count": 109,
    "class_vocabulary_used": ["stakeholder", "revenue"] OR "N/A (no list provided)",
    "grammar_structures_used": ["Present Perfect: 2 occurrences", "Conditionals: 3 occurrences"]
  },
  "corrected_text_minimal": "<string>",
  "suggested_polish_one_sentence": "<string>",
  "scores": {
    "grammar": {"points": 11, "out_of": 15, "rationale": "Good work with sentence structure! I can see you're trying different tenses. To improve further, consider using 'went' instead of 'go' for past events."},
    "vocabulary": {"points": 11, "out_of": 15, "rationale": "Nice effort with descriptive language! I noticed you used some interesting words. To improve further, consider using 'fascinating' instead of 'interesting' for more impact."},
    "spelling": {"points": 8, "out_of": 10, "rationale": "Well done on spelling most words correctly! Good effort with longer words. To improve further, double-check 'weekend' spelling."},
    "mechanics": {"points": 10, "out_of": 15, "rationale": "Good work with punctuation! I can see you're using periods well. To improve further, consider splitting longer sentences for clarity."},
    "fluency": {"points": 11, "out_of": 15, "rationale": "Nice flow in your writing! I can see clear connections between ideas. To improve further, consider adding transition words like 'then' and 'afterward'."},
    "layout": {"points": 12, "out_of": 15, "rationale": "Good paragraph organization! I can see logical structure in your ideas. To improve further, consider adding more transition words for smoother flow."},
    "content": {"points": 13, "out_of": 15, "rationale": "Excellent personal story development! I really enjoyed reading about your experiences. Great job including specific details and examples."}
  },
  "total": {"points": [calculated_total], "out_of": 100},
  "inline_issues": [
    {"type": "spelling", "subtype": "misspelling", "message": "wekend→weekend", "offsets": {"start": 8, "end": 14}},
    {"type": "grammar", "subtype": "tense", "message": "go→went (past tense)", "offsets": {"start": 16, "end": 18}},
    {"type": "mechanics-punctuation", "subtype": "run_on", "message": "Split into two sentences", "offsets": {"start": 55, "end": 86}},
    {"type": "fluency", "subtype": "naturalness", "message": "Consider replacing 'it's a light movie' with 'it's an easy movie' for more natural phrasing.", "offsets": {"start": 90, "end": 105}, "coaching_only": true}
  ],
  "teacher_notes": "Clear day-by-day story with good personal details. Nice effort on organization!",
  "encouragement_next_steps": [
    "Add 'then, after that, finally' to guide the reader through your story",
    "Change present verbs to past tense consistently (played, ordered, slept)",
    "Split very long sentences with periods for clarity"
  ]
}

Categories for scores must be exactly: grammar, vocabulary, spelling, mechanics-punctuation, fluency, layout, content

IMPORTANT: For inline_issues, use these correction guide categories:
- "grammar" (verb tenses, agreement, structures, word order)
- "mechanics-punctuation" (punctuation, capitalization, run-on sentences)  
- "spelling" (misspellings)
- "vocabulary-structure" (word choice, collocations, awkward phrasing)
- "needs-rephrasing" (unclear sentences that need restructuring)
- "redundancy" (repetitive words/phrases)
- "non-suitable-words" (inappropriate word choices)
- "fluency" (natural language coaching - see special instructions below)
- "professor-comments" (general feedback, suggestions for improvement)

ERROR CLASSIFICATION RULES — GRAMMAR VS FLUENCY

This clarifies the exact decision process for GPT.

Always mark truly incorrect grammar as grammar.

Examples:
- "too happy to can talk" → "very happy to be able to talk" or "so happy I can talk"
- "she go to school yesterday" → "she went to school yesterday"
- "I have 20 year old" → "I am 20 years old"

Grammar mistakes must always be highlighted, even if the sentence could be interpreted.

Use fluency only when grammar is correct but phrasing is unnatural.

Examples:
- "even when this show is from the 90s" → "even though this show is from the 90s"
- "it's a light show to watch" → "it's an easy show to watch"
- "he talks very loud" → "he talks very loudly"

Priority rule:
If you're unsure whether something is a grammar error or a fluency issue, treat it as grammar.
Do NOT leave ungrammatical text unmarked.

MODAL VERB & AUXILIARY CHECKS (MANDATORY)

Always flag:

Incorrect modal combinations:
- "to can" → "to be able to"
- "must to" → "must"
- "should to" → "should"

Missing auxiliary verbs:
- "He going to school" → "He is going to school"
- "She reading a book" → "She is reading a book"

COACHING-ONLY ISSUES

Natural language improvements should appear inline with type: fluency and "coaching_only": true.

These do NOT affect grades but show up in the color-coded essay for teaching purposes.

Example JSON output:
{
  "type": "fluency",
  "subtype": "naturalness",
  "message": "Consider replacing 'even when this show is from the 90s' with 'even though this show is from the 90s'",
  "offsets": {"start": 55, "end": 84},
  "coaching_only": true
}

FLUENCY COACHING (NATURAL LANGUAGE IMPROVEMENT):
Detect awkward or unnatural phrasing where a more natural alternative would sound better, even if the original is grammatically correct.

Examples:
- "even when this show is from the 90s" → "even though this show is from the 90s"
- "it's a light show to watch" → "it's an easy show to watch"
- "people like very much this movie" → "people like this movie a lot"
- "I am interesting in this topic" → "I am interested in this topic"
- "This is very much important" → "This is very important"

For fluency suggestions, use:
- type: "fluency"
- subtype: "naturalness" 
- coaching_only: true
- message: "Consider replacing '[original]' with '[suggestion]' for more natural phrasing."

CRITICAL: DO NOT deduct points for fluency suggestions - they are coaching-only improvements.

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

STEP 1: ERROR DETECTION (find ALL objective errors)

Tag every instance of: articles, capitalization, agreement, tense, prepositions, word order, spelling, missing punctuation, run-ons, and clear vocabulary misuses.

Do not propose large stylistic rewrites in inline_issues. Large improvements belong in rationales.

STEP 2: MINIMAL CORRECTED TEXT (teach-first)

Produce corrected_text_minimal: the smallest set of edits that make the text grammatical and faithful to the original meaning.

Keep clause order unless ungrammatical.

STEP 3: OPTIONAL POLISH (coaching only)

Produce suggested_polish_one_sentence: choose one representative sentence and show a more natural rewrite (coaching), but do not rewrite the whole essay.

STEP 4: GRADING ANALYSIS
1. Count total words (transitions will be detected automatically)
2. Identify and count vocabulary from class list: ${classProfile.vocabulary.join(', ')}
3. Identify and count ALL OCCURRENCES of grammar structures from class: ${classProfile.grammar.join(', ')} 
   IMPORTANT: Count EACH individual use/occurrence, not just whether the category appears
   Example: If student uses "have done" twice and "has finished" once, report "Present Perfect: 3 occurrences"
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

GRAMMAR CONTEXT AWARENESS: 
• VALID CONSTRUCTIONS - DO NOT FLAG AS ERRORS:
  - "is having" when describing ongoing effects/impact (e.g., "rest is having on my energy")
  - Progressive forms with stative verbs when expressing temporary states or ongoing effects
  - Present tense for current/general statements even in past narratives (e.g., "now today is Monday")

PAST TENSE CONTEXT DETECTION: If the essay contains past time markers ("past weekend", "on friday", "then", "yesterday", etc.) or past verbs ("came", "played", "woke"), assume past narrative context. For past context:
- "make my homework" → "did my homework"
- "making my homework" → "was doing my homework"
- "make homework" → "did homework"`
      }]
    });

  try {
    let content = response.choices[0].message.content;

    // Remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const result = JSON.parse(content);
    
    // Add transition word detection locally (more reliable than GPT)
    const detectedTransitions = detectTransitionWords(studentText);
    console.log("=== DEBUG: Transition Detection ===");
    console.log("Student text length:", studentText.length);
    console.log("First 200 chars:", studentText.substring(0, 200));
    console.log("Detected transitions:", detectedTransitions);
    
    if (!result.meta) result.meta = {};
    result.meta.transition_words_found = detectedTransitions;
    
    // Add class vocabulary detection locally
    const detectedVocab = detectClassVocabulary(studentText, classProfile.vocabulary);
    console.log("=== DEBUG: Vocabulary Detection ===");
    console.log("Class vocabulary count:", classProfile.vocabulary.length);
    console.log("Detected vocabulary:", detectedVocab);
    result.meta.class_vocabulary_used = detectedVocab.length > 0 ? detectedVocab : "N/A (no matches found)";
    
    // Safety net: Add missing common errors
    if (result.inline_issues) {
      result.inline_issues = patchCommonErrors(studentText, result.inline_issues);
      result.inline_issues = patchModalAndTooUsage(studentText, result.inline_issues);
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
    
    // Apply CEFR level strictness modifier to scores - adjusted for all CEFR levels
    if (result.scores) {
      // CEFR level leniency: A levels are most lenient, C levels are strictest
      // A1/A2: Very lenient for beginners, A2: Lenient for elementary,
      // B1: Moderate leniency for intermediate, B2: Enhanced leniency for upper-intermediate
      // C1: Standard strictness, C2: Strict for near-native level
      const leniencyMultipliers = {
        'A1': 1.30,  // Very lenient for beginners
        'A2': 1.25,  // Lenient for elementary
        'B1': 1.20,  // Moderate leniency for intermediate
        'B2': 1.15,  // Enhanced leniency for upper-intermediate
        'C1': 1.05,  // Slight leniency for advanced
        'C2': 1.0    // Standard strictness for near-native
      };
      const leniencyMultiplier = leniencyMultipliers[cefrLevel] || 1.0;
      
      Object.keys(result.scores).forEach(cat => {
        if (result.scores[cat].points) {
          // Apply leniency by boosting scores, capped at maximum
          result.scores[cat].points = Math.min(result.scores[cat].out_of, 
            Math.round(result.scores[cat].points * leniencyMultiplier));
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


function patchCommonErrors(text, issues) {
  const newIssues = [];
  
  // 1. Lowercase "i" (personal pronoun)
  const iRegex = /\b i \b/g;
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
  
  // 2. Lowercase day names
  const dayRegex = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
  for (const match of text.matchAll(dayRegex)) {
    const day = match[1];
    const properDay = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
    
    if (day !== properDay && !isAlreadyCovered(match.index, match.index + day.length, issues)) {
      newIssues.push({
        type: "mechanics-punctuation",
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
        type: "mechanics-punctuation",
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
        type: "vocabulary-structure",
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

function patchModalAndTooUsage(text, issues) {
  const newIssues = [];

  // 1) 'to can' → 'to be able to'
  for (const m of text.matchAll(/\bto\s+can\b/gi)) {
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
  for (const m of text.matchAll(/\b(must|should)\s+to\b/gi)) {
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
  for (const m of text.matchAll(/\btoo\s+([a-z]+)\s+to\s+can\s+([a-z]+)\b/gi)) {
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

// Helper function for fuzzy string matching
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

function detectTransitionWords(text) {
  // Comprehensive list of transition words and phrases
  const transitionWords = {
    // Sequence/Time
    sequence: ['first', 'first of all', 'firstly', 'second', 'secondly', 'third', 'thirdly', 'then', 'next', 'after', 'before', 'during', 'while', 'when', 'finally', 'eventually', 'meanwhile', 'simultaneously', 'afterward', 'afterwards', 'later', 'soon', 'previously', 'formerly', 'initially', 'ultimately', 'subsequently'],
    
    // Addition
    addition: ['also', 'and', 'furthermore', 'moreover', 'in addition', 'additionally', 'besides', 'plus', 'as well as', 'too', 'again', 'another', 'along with', 'likewise', 'similarly'],
    
    // Contrast/Opposition  
    contrast: ['but', 'however', 'although', 'though', 'even though', 'despite', 'in spite of', 'nevertheless', 'nonetheless', 'on the other hand', 'in contrast', 'conversely', 'whereas', 'while', 'yet', 'still', 'otherwise', 'instead'],
    
    // Cause/Effect
    causality: ['because', 'since', 'therefore', 'thus', 'consequently', 'as a result', 'so', 'hence', 'accordingly', 'due to', 'owing to', 'for this reason', 'that is why', 'leads to', 'causes', 'results in'],
    
    // Example/Emphasis
    example: ['for example', 'for instance', 'such as', 'including', 'especially', 'particularly', 'notably', 'specifically', 'in fact', 'indeed', 'certainly', 'clearly', 'obviously'],
    
    // Conclusion
    conclusion: ['in conclusion', 'to conclude', 'in summary', 'to summarize', 'overall', 'all in all', 'in short', 'briefly', 'to sum up', 'on the whole', 'generally', 'basically'],
    
    // Comparison
    comparison: ['like', 'unlike', 'similar to', 'different from', 'compared to', 'in comparison', 'equally', 'both', 'neither', 'either'],
    
    // Frequency
    frequency: ['always', 'usually', 'often', 'sometimes', 'occasionally', 'rarely', 'never', 'frequently', 'seldom', 'hardly ever', 'once in a while']
  };

  // Flatten all transition words into a single array
  const allTransitions = Object.values(transitionWords).flat();
  
  const foundTransitions = [];
  
  // First pass: Exact matches (case insensitive, word boundaries)
  allTransitions.forEach(transition => {
    // Handle multi-word transitions (like "in addition")
    const escapedTransition = transition.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escapedTransition}\\b`, 'gi');
    
    const matches = [...text.matchAll(pattern)];
    matches.forEach(match => {
      // Avoid duplicates
      if (!foundTransitions.some(t => t.word === match[0].toLowerCase() && t.position === match.index)) {
        foundTransitions.push({
          word: match[0].toLowerCase(),
          position: match.index,
          category: Object.keys(transitionWords).find(cat => 
            transitionWords[cat].includes(transition.toLowerCase())
          ),
          original: match[0]
        });
      }
    });
  });
  
  // Second pass: Fuzzy matching for single-word transitions only (to avoid false positives with phrases)
  const singleWordTransitions = allTransitions.filter(t => !t.includes(' '));
  const words = text.match(/\b[a-zA-Z]+\b/g) || [];
  
  words.forEach((word, wordIndex) => {
    const wordLower = word.toLowerCase();
    
    // Skip if already found as exact match
    if (foundTransitions.some(t => t.original.toLowerCase() === wordLower)) {
      return;
    }
    
    singleWordTransitions.forEach(transition => {
      const distance = levenshteinDistance(wordLower, transition.toLowerCase());
      const maxDistance = transition.length <= 4 ? 1 : 2; // Allow 1 error for short words, 2 for longer
      
      if (distance > 0 && distance <= maxDistance) {
        // Get word position in original text
        const wordPattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const wordMatches = [...text.matchAll(wordPattern)];
        
        wordMatches.forEach(match => {
          // Avoid duplicates and don't add if we already found a closer match
          if (!foundTransitions.some(t => Math.abs(t.position - match.index) < 10)) {
            foundTransitions.push({
              word: transition.toLowerCase(),
              position: match.index,
              category: Object.keys(transitionWords).find(cat => 
                transitionWords[cat].includes(transition.toLowerCase())
              ),
              original: match[0],
              misspelled: true,
              corrected_from: word
            });
          }
        });
      }
    });
  });
  
  // Sort by position in text
  foundTransitions.sort((a, b) => a.position - b.position);
  
  // Debug output for misspelled transitions
  const misspelledTransitions = foundTransitions.filter(t => t.misspelled);
  if (misspelledTransitions.length > 0) {
    console.log("=== DEBUG: Misspelled Transitions Found ===");
    misspelledTransitions.forEach(t => {
      console.log(`"${t.corrected_from}" → "${t.word}" (${t.category})`);
    });
  }
  
  // Return just the words for compatibility with existing code
  return foundTransitions.map(t => t.word);
}

function detectClassVocabulary(text, classVocabulary) {
  if (!classVocabulary || classVocabulary.length === 0) {
    return [];
  }
  
  const foundVocab = [];
  const textLower = text.toLowerCase();
  
  // Separate exact words, prefixes, and suffixes
  const exactWords = [];
  const prefixes = [];
  const suffixes = [];
  
  let currentSection = 'words';
  
  for (const item of classVocabulary) {
    const itemLower = item.toLowerCase().trim();
    
    if (itemLower.includes('prefixes')) {
      currentSection = 'prefixes';
      continue;
    } else if (itemLower.includes('suffixes')) {
      currentSection = 'suffixes';
      continue;
    }
    
    if (currentSection === 'prefixes' && itemLower.endsWith('-')) {
      // Handle compound prefixes like "in-/im-/il-/ir-"
      const prefixParts = itemLower.replace('-', '').split('/');
      prefixParts.forEach(part => {
        const cleanPart = part.replace(/-/g, '').trim();
        if (cleanPart.length > 0) {
          prefixes.push(cleanPart);
        }
      });
    } else if (currentSection === 'suffixes' && itemLower.startsWith('-')) {
      suffixes.push(itemLower.replace('-', '').replace(/,.*$/, '').trim()); // Handle cases like "-able, -ible"
    } else if (currentSection === 'words') {
      exactWords.push(item);
    }
  }
  
  // Find exact word matches (case insensitive)
  exactWords.forEach(word => {
    const wordLower = word.toLowerCase();
    const regex = new RegExp(`\\b${wordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = [...text.matchAll(regex)];
    
    matches.forEach(match => {
      if (!foundVocab.some(v => v.word.toLowerCase() === match[0].toLowerCase() && v.position === match.index)) {
        foundVocab.push({
          word: match[0],
          position: match.index,
          type: 'exact',
          matchedFrom: word
        });
      }
    });
  });
  
  // Find fuzzy matches for exact words (only single words to avoid false positives with phrases)
  const singleWordVocab = exactWords.filter(word => !word.includes(' ') && word.length > 3); // Only check words longer than 3 chars
  const textWords = text.match(/\b[a-zA-Z]+\b/g) || [];
  
  textWords.forEach(textWord => {
    const textWordLower = textWord.toLowerCase();
    
    // Skip if already found as exact match
    if (foundVocab.some(v => v.word.toLowerCase() === textWordLower)) {
      return;
    }
    
    singleWordVocab.forEach(vocabWord => {
      const vocabWordLower = vocabWord.toLowerCase();
      const distance = levenshteinDistance(textWordLower, vocabWordLower);
      const maxDistance = vocabWord.length <= 5 ? 1 : 2; // Allow 1 error for short words, 2 for longer
      
      if (distance > 0 && distance <= maxDistance) {
        // Get word position in original text
        const wordPattern = new RegExp(`\\b${textWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const wordMatches = [...text.matchAll(wordPattern)];
        
        wordMatches.forEach(match => {
          // Avoid duplicates and don't add if we already found a closer match
          if (!foundVocab.some(v => Math.abs(v.position - match.index) < 5)) {
            foundVocab.push({
              word: vocabWord, // Use the correct vocabulary word
              position: match.index,
              type: 'exact_fuzzy',
              matchedFrom: vocabWord,
              misspelled: true,
              corrected_from: textWord
            });
          }
        });
      }
    });
  });
  
  // Find prefix matches
  prefixes.forEach(prefix => {
    // Look for words that start with this prefix
    const regex = new RegExp(`\\b${prefix}[a-zA-Z]+\\b`, 'gi');
    const matches = [...text.matchAll(regex)];
    
    matches.forEach(match => {
      const word = match[0];
      if (!foundVocab.some(v => v.word.toLowerCase() === word.toLowerCase() && v.position === match.index)) {
        foundVocab.push({
          word: word,
          position: match.index,
          type: 'prefix',
          matchedFrom: prefix + '-'
        });
      }
    });
  });
  
  // Find suffix matches
  suffixes.forEach(suffix => {
    // Handle compound suffixes like "able, ible" or "tion, sion"
    const suffixVariants = suffix.split(',').map(s => s.trim());
    
    suffixVariants.forEach(variant => {
      if (variant && variant.length > 1) {
        const regex = new RegExp(`\\b[a-zA-Z]+${variant}\\b`, 'gi');
        const matches = [...text.matchAll(regex)];
        
        matches.forEach(match => {
          const word = match[0];
          if (!foundVocab.some(v => v.word.toLowerCase() === word.toLowerCase() && v.position === match.index)) {
            foundVocab.push({
              word: word,
              position: match.index,
              type: 'suffix',
              matchedFrom: '-' + variant
            });
          }
        });
      }
    });
  });
  
  // Debug output for misspelled vocabulary
  const misspelledVocab = foundVocab.filter(v => v.misspelled);
  if (misspelledVocab.length > 0) {
    console.log("=== DEBUG: Misspelled Vocabulary Found ===");
    misspelledVocab.forEach(v => {
      console.log(`"${v.corrected_from}" → "${v.word}" (${v.type})`);
    });
  }
  
  // Sort by position and return just the words
  foundVocab.sort((a, b) => a.position - b.position);
  return foundVocab.map(v => v.word);
}
