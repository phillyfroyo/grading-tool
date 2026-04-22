# Grading API — Demo Metrics

**Run window (UTC):** 2026-04-22T16:44:25.890Z → 2026-04-22T16:56:20.187Z
**Target:** `https://grading-tool-git-apiextractionv1-philip-woolery-prices-projects.vercel.app`
**Fixtures:** 20 synthetic B2 ESL essays (5 short / 10 medium / 5 long), shared inline rubric.
**Caveat:** synthetic essays are cleaner than real student writing; latency numbers are a lower bound on real-world.

## Phase 2 — Cold start

- First call (possibly cold): **9.64s** (HTTP 200)
- After 10-min idle: **11.32s** (HTTP 200)
- Delta: +1.69s

> Idle didn't meaningfully penalize the next call. Vercel likely kept the function warm during the wait.

## Phase 4 — Batch streaming (`/v1/grade-batch`)

- Total wall time: **93.25s**
- Time to first `result` event: **11.51s**
- Results received: 20 (20 ok, 0 fail)
- Inter-result gap — P50: 0.02s, P90: 11.07s, mean: 4.30s

Batch graded 20 essays in 93.25s — ~4.66s per essay amortized (vs. sequential P50 above). That ratio is your concurrency-win argument for the meeting.

## Cost sidebar

The script can't pull OpenAI costs programmatically. Cross-reference the OpenAI dashboard for the time window above (2026-04-22T16:44:25.890Z → 2026-04-22T16:56:20.187Z) and divide total cost by number of essays graded to get cost-per-grade. Record both the single-grade phase and the batch phase — they should be similar since the underlying LLM call is the same.
