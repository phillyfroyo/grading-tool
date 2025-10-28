# API Call Architecture Comparison

## Overview of All Grading Approaches

This document compares the API call structure, prompts, and task division across different grading systems.

---

## 🔵 APPROACH 1: Main Branch (2-Step)

**File:** `grader/grader-two-step.js`

### API Calls: 2 Total

#### Call #1: Error Detection + Metrics (COMBINED)
- **Prompt:** `error-detection-prompt.js` (240+ lines)
- **Temperature:** 0.5
- **Tasks (MULTIPLE):**
  1. Find all errors (spelling, grammar, vocabulary, mechanics, fluency)
  2. Calculate character offsets (start/end positions)
  3. Generate corrections
  4. Write explanations
  5. Count word count
  6. Identify class vocabulary used
  7. Identify grammar structures used
  8. Find transition words
  9. Count vocabulary items
- **Output:**
  ```json
  {
    "inline_issues": [...],
    "corrected_text_minimal": "...",
    "vocabulary_count": 5,
    "class_vocabulary_used": [...],
    "grammar_structures_used": [...],
    "transition_words_found": [...],
    "word_count": 150
  }
  ```

**⚠️ Problem:** Too many tasks in one call at moderate temperature
- Metrics counting (deterministic task) at temp 0.5 = inconsistent results
- Error detection + counting = split attention
- 240+ line prompt = cognitive overload

#### Call #2: Rubric Grading
- **Prompt:** `grading-prompt.js`
- **Temperature:** 0.2
- **Tasks:**
  1. Review errors from Call #1
  2. Apply 7-category rubric
  3. Calculate 0-100 score
  4. Generate teacher feedback
  5. Apply CEFR level adjustments
- **Output:**
  ```json
  {
    "score": 75,
    "category_scores": {...},
    "positive_feedback": "...",
    "areas_for_improvement": "...",
    "teacher_rationale": "..."
  }
  ```

### Summary
- **Total API Calls:** 2
- **Strengths:** Fewer API calls, faster
- **Weaknesses:**
  - Mixed deterministic + creative tasks in Call #1
  - Metrics inconsistent due to temp 0.5
  - Complex 240+ line prompt hurts error detection
  - 14 false negatives in testing

---

## 🔴 APPROACH 2: Hybrid 4-Step (Current Branch)

**File:** `grader/grader-hybrid.js`

### API Calls: 4 Total (2 parallel, then 2 sequential)

#### Call #1a: Conservative Error Detection (PARALLEL)
- **Prompt:** `error-detection-conservative.js` (121 lines)
- **Temperature:** 0.1 (very conservative)
- **Tasks:**
  1. Find ONLY high-confidence errors
  2. "When in doubt, DON'T flag it"
  3. Calculate offsets
  4. Generate corrections
- **Principle:** Minimize false positives
- **Output:** Array of high-confidence errors only

#### Call #1b: Thorough Error Detection (PARALLEL)
- **Prompt:** `error-detection-thorough.js` (145 lines)
- **Temperature:** 0.4 (more exploratory)
- **Tasks:**
  1. Find ALL possible errors (including subtle ones)
  2. Prepositions, collocations, fluency
  3. Calculate offsets
  4. Generate corrections
- **Principle:** Maximize recall (catch everything)
- **Output:** Array of all possible errors (higher false positive risk)

**🔄 Parallel execution** - both run simultaneously

#### Call #2: Error Reconciliation
- **Prompt:** `error-reconciliation.js` (151 lines)
- **Temperature:** 0.1
- **Tasks:**
  1. Compare conservative vs thorough lists
  2. Identify consensus errors (in both lists)
  3. Validate thorough-only errors
  4. Remove false positives
  5. Fix atomic span violations
  6. Improve correction note quality
- **Input:** Results from Call #1a + #1b
- **Output:**
  ```json
  {
    "verified_errors": [...],
    "consensus_errors": [...],
    "removed_false_positives": [...]
  }
  ```

**⚠️ Problem:** Reconciliation degrades note quality (test showed "inadequate" notes)

#### Call #3: Metrics Counting
- **Prompt:** `metrics-prompt.js` (106 lines)
- **Temperature:** 0.1 (deterministic)
- **Tasks:**
  1. Count words
  2. Count paragraphs/sentences
  3. Find class vocabulary
  4. Find grammar structures
  5. Find transitions
- **Output:**
  ```json
  {
    "word_count": 150,
    "class_vocabulary_used": [...],
    "grammar_structures_used": [...],
    "transition_words_found": [...]
  }
  ```

**⚠️ Problem:** Test showed INACCURATE metrics despite separation (unexpected!)

#### Call #4: Rubric Grading
- **Prompt:** `grading-prompt.js`
- **Temperature:** 0.1
- **Tasks:** Same as Approach 1
- **Input:** Verified errors from Call #2 + metrics from Call #3

### Summary
- **Total API Calls:** 4
- **Strengths:**
  - Dual detection theoretically reduces false negatives AND false positives
  - Separated metrics should be more consistent
  - Explicit quality control step
- **Weaknesses (FROM ACTUAL TESTING):**
  - Still had ~7 false negatives
  - **Added false positives** (worse than main!)
  - **Note quality degraded** ("inadequate")
  - **Metrics LESS accurate** than main (unexpected)
  - 16+ total manual edits vs 14 in main
  - More complexity = more failure points

---

## 🟢 APPROACH 3: Simplified 3-Step (NEW)

**File:** `grader/grader-simple.js` (NEW)

### API Calls: 3 Total (all sequential)

#### Call #1: Simple Error Detection
- **Prompt:** `error-detection-simple.js` (~40 lines - RADICALLY simplified)
- **Temperature:** 0.3 (moderate - balanced)
- **Tasks (SINGLE FOCUS):**
  1. Find all clear errors in the essay
  2. Provide error_text, correction, explanation, category
  3. **NO character offset calculation** (system handles this via text matching)
  4. **NO metrics counting** (separated)
  5. **NO complex rules** (just "point out clear errors")

**Prompt structure:**
```
You are an expert ESL writing teacher. Point out all the clear errors.

For each error, provide:
1. Category (spelling, grammar, vocabulary, mechanics, fluency)
2. The exact text with the error
3. The correction
4. A brief explanation (3-10 words)

[Simple category definitions - 10 lines]
[Simple output format]

STUDENT TEXT:
"""..."""
```

**Output:**
```json
{
  "errors": [
    {
      "category": "spelling",
      "error_text": "recieve",
      "correction": "receive",
      "explanation": "Incorrect spelling"
    },
    {
      "category": "grammar",
      "error_text": "He don't like",
      "correction": "He doesn't like",
      "explanation": "Subject-verb agreement"
    }
  ]
}
```

**🔑 Key Innovation:** System converts `error_text` to offsets via text matching
- GPT just identifies the error text naturally (what it's good at)
- System finds position in essay (what code is good at)
- Removes cognitive burden from GPT

#### Call #2: Deterministic Metrics
- **Prompt:** Inline (~30 lines)
- **Temperature:** 0.1 (very low for consistency)
- **Tasks (SINGLE FOCUS):**
  1. Count word count
  2. Count paragraphs
  3. Count sentences
  4. Identify class vocabulary used
  5. Identify grammar structures used
  6. Find transition words

**Prompt structure:**
```
Count the following metrics in this essay. Be precise and deterministic.

CLASS VOCABULARY (N items):
[list]

GRAMMAR STRUCTURES:
[list]

Return JSON:
{
  "word_count": <number>,
  "paragraph_count": <number>,
  ...
}

STUDENT TEXT:
"""..."""
```

**Output:**
```json
{
  "word_count": 150,
  "paragraph_count": 3,
  "sentence_count": 12,
  "class_vocabulary_used": ["however", "therefore"],
  "grammar_structures_used": ["Present Perfect"],
  "transition_words_found": ["however", "moreover"]
}
```

**🔑 Key Advantage:** Pure counting task at low temp = consistent results

#### Call #3: Rubric Grading
- **Prompt:** `grading-prompt.js` (existing)
- **Temperature:** 0.2
- **Tasks:**
  1. Review errors from Call #1
  2. Review metrics from Call #2
  3. Apply 7-category rubric
  4. Calculate score
  5. Generate feedback

**Input:** Errors + Metrics (both clean, focused results)

### Summary
- **Total API Calls:** 3
- **Strengths:**
  - **Simple prompts** = GPT can focus (mimics ChatGPT's natural performance)
  - **Separated concerns** = each call has single focus
  - **No offset calculation burden** = system handles via text matching
  - **Deterministic metrics** = low temp counting
  - **Maintainable** = 40-line prompts you can reason about
- **Predicted Results:**
  - More errors found (like ChatGPT)
  - Better error quality
  - Accurate metrics
  - Fewer false positives (focused detection)
  - Faster overall (efficient use of API calls)

---

## 📊 Architecture Comparison Table

| Aspect | Main (2-Step) | Hybrid (4-Step) | Simple (3-Step) |
|--------|---------------|-----------------|-----------------|
| **API Calls** | 2 | 4 (2 parallel) | 3 |
| **Prompt Complexity** | 240+ lines | 4 prompts (523 lines total) | ~70 lines total |
| **Error Detection** | 1 pass @ temp 0.5 | 2 passes @ temp 0.1/0.4 | 1 pass @ temp 0.3 |
| **Metrics Counting** | Mixed with errors @ 0.5 | Separate @ 0.1 | Separate @ 0.1 |
| **Offset Calculation** | GPT calculates | GPT calculates | System calculates |
| **False Negatives** | 14 (tested) | ~7 (tested) | ? (predict: 5-8) |
| **False Positives** | 0 (tested) | Multiple (tested) | ? (predict: 0-2) |
| **Note Quality** | Good (tested) | Inadequate (tested) | ? (predict: good) |
| **Metrics Accuracy** | Good (tested) | Inaccurate (tested) | ? (predict: excellent) |
| **Total Manual Edits** | ~14 | 16+ | ? (predict: 8-12) |
| **Maintainability** | Medium | Low (complex) | High (simple) |
| **ChatGPT Similarity** | Low | Low | High ⭐ |

---

## 🎯 Task Separation Strategy Analysis

### ✅ Good Task Separation (Simple 3-Step)

**Call 1: Creative task** (error detection)
- Temperature: 0.3 (moderate)
- Task type: Analytical, pattern recognition
- Prompt: Simple, focused

**Call 2: Deterministic task** (counting)
- Temperature: 0.1 (low)
- Task type: Objective counting
- Prompt: Clear instructions

**Call 3: Evaluative task** (grading)
- Temperature: 0.2 (low-moderate)
- Task type: Rubric application
- Input: Clean data from Calls 1+2

**Why it works:**
- Each call has ONE type of task
- Temperature matches task type
- No cognitive overload
- Clean inputs/outputs

### ❌ Poor Task Separation (Hybrid 4-Step)

**Problem 1:** Dual detection creates confusion
- Conservative @ 0.1: "Don't flag anything uncertain"
- Thorough @ 0.4: "Flag everything including uncertain"
- Reconciliation must resolve conflicting philosophies
- Result: Degraded quality

**Problem 2:** More steps = more error propagation
- Call 1a/1b errors → Call 2 reconciliation errors → Call 4 grading errors
- Each step adds variance

**Problem 3:** Complexity ≠ Quality
- 523 total lines of prompts
- Conflicting instructions across prompts
- Test results: WORSE than simpler approach

### ⚠️ Mixed Task Separation (Main 2-Step)

**Problem:** Creative + Deterministic mixed
- Error detection (creative) at temp 0.5
- Word counting (deterministic) at temp 0.5
- Result: Inconsistent metrics

**But:** Simple enough to work decently
- Only 2 calls = less error propagation
- 240-line prompt is manageable (barely)
- Real test: 14 false negatives, 0 false positives

---

## 💡 Recommendations

### For Maximum Quality (RECOMMENDED)
**Use: Simple 3-Step Approach**

1. Test it first with `test-simple-vs-complex.js`
2. If it matches ChatGPT's performance (likely), adopt it
3. Fine-tune only temperature if needed (0.2-0.4 range)

### For Quick Win
**Modify Main 2-Step:**
1. Extract metrics counting to separate Call #2a
2. Keep error detection at Call #1
3. Simplify error detection prompt (remove 150+ lines of rules)
4. Add Call #3 for grading

This gets you better metrics accuracy without full rewrite.

### Don't Use
**Hybrid 4-Step approach** - actual testing proved it's worse

---

## 🔬 Testing Protocol

Run comparison test:
```bash
node test-simple-vs-complex.js "YOUR_TEST_ESSAY" PROFILE_ID
```

Manually review results for:
- ✅ **False Positives** (flagged but actually correct)
- ✅ **False Negatives** (errors missed)
- ✅ **Note Quality** (helpful vs inadequate)
- ✅ **Metrics Accuracy** (word count, transitions, etc.)
- ✅ **Total Manual Edit Time** (the real metric)

Compare against ChatGPT:
1. Copy same essay to ChatGPT
2. Prompt: "Point out all the errors in this essay"
3. Compare results
4. If Simple 3-Step matches ChatGPT → winner found

---

*Last updated: 2025-10-25*
