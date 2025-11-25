# Claude API Token Usage Reference

## Overview
This document tracks token usage for Claude API calls to help estimate costs and plan usage.

## Token Usage by Essay Type

### Average Essay (Reference Point)
**Date:** November 21, 2025
**Model:** claude-sonnet-4-20250514
**Essay Length:** 214 words, 1,152 characters

**Token Usage:**
- **Input tokens:** 6,183
- **Output tokens:** 1,639
- **Total tokens:** 7,822

**API Calls:** 3 calls total
1. Error Detection
2. Metrics Counting
3. Final Grading with Rubric

**Estimated Range:** 5,000 - 10,000 tokens per average essay

---

## Cost Estimation

### Claude Sonnet 4 Pricing
- Input: $3.00 per million tokens
- Output: $15.00 per million tokens

### Cost per Average Essay
Based on the reference point above:
- Input cost: 6,183 × $3.00 / 1,000,000 = **$0.0186**
- Output cost: 1,639 × $15.00 / 1,000,000 = **$0.0246**
- **Total per essay: ~$0.043** (4.3 cents)

### Batch Estimates
- 10 essays: ~$0.43
- 50 essays: ~$2.15
- 100 essays: ~$4.30
- 500 essays: ~$21.50

*Note: Actual costs may vary based on essay length, complexity, and number of errors detected.*

---

## Usage Tracking

Add new reference points below as you grade different types of essays:

### Short Essay (< 150 words)
- Input tokens: TBD
- Output tokens: TBD
- Total tokens: TBD

### Long Essay (> 300 words)
- Input tokens: TBD
- Output tokens: TBD
- Total tokens: TBD

### Complex Essay (many errors)
- Input tokens: TBD
- Output tokens: TBD
- Total tokens: TBD

---

## Comparison: Claude vs GPT-4

### GPT-4o Pricing
- Input: $2.50 per million tokens
- Output: $10.00 per million tokens

### Cost Comparison (Average Essay)
| Provider | Input Cost | Output Cost | Total Cost |
|----------|------------|-------------|------------|
| Claude Sonnet 4 | $0.0186 | $0.0246 | **$0.043** |
| GPT-4o | $0.0155 | $0.0164 | **$0.032** |

**Difference:** Claude costs ~34% more per essay (~$0.011 or 1.1 cents)

---

## Notes
- Token usage includes the full grading pipeline (3 API calls)
- Includes class profile data, rubric, and prompts in each call
- Output tokens include all grading results, teacher notes, and inline issues
- Temperature adjustment is done locally (no additional API cost)
