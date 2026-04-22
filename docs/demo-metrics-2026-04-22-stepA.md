# Grading API — Demo Metrics

**Run window (UTC):** 2026-04-22T16:35:34.298Z → 2026-04-22T16:38:58.903Z
**Target:** `https://grading-tool-git-apiextractionv1-philip-woolery-prices-projects.vercel.app`
**Fixtures:** 20 synthetic B2 ESL essays (5 short / 10 medium / 5 long), shared inline rubric.
**Caveat:** synthetic essays are cleaner than real student writing; latency numbers are a lower bound on real-world.

## Phase 1 — Error envelopes

| Case | Expected | Actual | Match | `error.code` | Latency |
|---|---|---|---|---|---|
| Missing Authorization header | 401 | 401 | ✓ | `unauthorized` | 2.09s |
| Bad bearer token | 401 | 401 | ✓ | `unauthorized` | 0.81s |
| Missing essay field | 400 | 400 | ✓ | `invalid_request` | 0.79s |
| Essay over 10,000 chars | 400 | 400 | ✓ | `invalid_request` | 0.78s |
| Rubric vocabulary over 150 items | 400 | 400 | ✓ | `invalid_request` | 0.51s |
| Malformed JSON body | 400 | 400 | ✓ | `invalid_request` | 0.26s |

## Phase 3 — Sequential single-grade latency

20 succeeded, 0 failed. Wall time: 197.78s.

| Stat | Value |
|---|---|
| P50 | **8.51s** |
| P90 | **10.32s** |
| Mean | 8.84s |
| Min | 5.61s |
| Max | 16.75s |

**By bucket:**

| Bucket | N | P50 | P90 | Mean |
|---|---|---|---|---|
| short | 5 | 9.06s | 16.75s | 10.15s |
| medium | 10 | 8.15s | 10.23s | 8.24s |
| long | 5 | 9.05s | 10.03s | 8.74s |

<details><summary>Per-essay detail</summary>

| # | ID | Bucket | HTTP | Latency | Score | Word ct |
|---|---|---|---|---|---|---|
| 1 | short-01 | short | 200 | 10.32s | 44 | 55 |
| 2 | short-02 | short | 200 | 9.01s | 42 | 59 |
| 3 | short-03 | short | 200 | 9.06s | 51 | 50 |
| 4 | short-04 | short | 200 | 5.61s | 42 | 55 |
| 5 | short-05 | short | 200 | 16.75s | 42 | 56 |
| 6 | medium-01 | medium | 200 | 10.85s | 75 | 202 |
| 7 | medium-02 | medium | 200 | 7.80s | 74 | 228 |
| 8 | medium-03 | medium | 200 | 8.51s | 77 | 224 |
| 9 | medium-04 | medium | 200 | 8.15s | 71 | 223 |
| 10 | medium-05 | medium | 200 | 8.33s | 72 | 230 |
| 11 | medium-06 | medium | 200 | 10.23s | 67 | 235 |
| 12 | medium-07 | medium | 200 | 6.64s | 67 | 241 |
| 13 | medium-08 | medium | 200 | 7.06s | 71 | 233 |
| 14 | medium-09 | medium | 200 | 8.55s | 82 | 238 |
| 15 | medium-10 | medium | 200 | 6.24s | 74 | 247 |
| 16 | long-01 | long | 200 | 9.91s | 67 | 395 |
| 17 | long-02 | long | 200 | 10.03s | 82 | 420 |
| 18 | long-03 | long | 200 | 7.70s | 73 | 450 |
| 19 | long-04 | long | 200 | 6.99s | 82 | 546 |
| 20 | long-05 | long | 200 | 9.05s | 77 | 600 |

</details>

## Cost sidebar

The script can't pull OpenAI costs programmatically. Cross-reference the OpenAI dashboard for the time window above (2026-04-22T16:35:34.298Z → 2026-04-22T16:38:58.903Z) and divide total cost by number of essays graded to get cost-per-grade. Record both the single-grade phase and the batch phase — they should be similar since the underlying LLM call is the same.
