# Grading API — Akdmic Integration Summary

**Prepared for:** Akdmic developer meeting
**Date prepared:** 2026-04-22
**Status:** Staging deployment, integration-ready.

---

## What it does

A stateless HTTP API that grades ESL/EFL student essays against a
caller-provided rubric. Returns numeric scores (7 categories + total),
teacher-style feedback, and structured inline error highlights with
character offsets so integrators can render highlights in their own UI.

**Two endpoints:**

- `POST /v1/grade` — single essay, JSON response, ~10s typical
- `POST /v1/grade-batch` — up to 60 essays, Server-Sent Events stream,
  ~5s per essay amortized

No database lookup. No user account on our side. The rubric travels
with each request — CEFR level, target vocabulary, target grammar,
optional word-count range.

---

## Performance (measured 2026-04-22, 63 grades against staging)

| Metric | Value | Notes |
|---|---|---|
| Single-essay P50 latency | **8.5s** | 200-250 word essays |
| Single-essay P90 latency | **10.3s** | |
| Single-essay max observed | 16.8s | Short-essay outlier |
| Batch amortized per essay | **4.7s** | Parallelism 2 server-side |
| Batch of 20 essays, total | 93s | vs. 198s sequential |
| Cold-start penalty | +1.7s | Non-issue; Vercel stays warm |
| Success rate | **63/63** | 100% over today's runs |
| Cost per grade (observed) | **~$0.0165** | GPT-4o; $1.04 / 63 grades |

**Caveat:** measured against hand-written synthetic essays that are
slightly cleaner than authentic student writing. Real-world latency is
likely to skew ~10-15% higher with more inline errors to detect.

---

## API contract at a glance

### Request
```
POST /v1/grade
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "essay": "...",
  "prompt": "optional assignment instructions",
  "studentNickname": "optional, for personalized feedback",
  "rubric": {
    "cefrLevel": "B2",
    "vocabulary": ["target", "words"],
    "grammar": ["past simple", "relative clauses"],
    "requiredWordCountMin": 200,
    "requiredWordCountMax": 250
  }
}
```

### Response (shape)
```
{
  "success": true,
  "scores": { "grammar": {...}, "vocabulary": {...}, ... },  // 7 categories
  "total": { "points": 78, "out_of": 100 },
  "overallScore": 78,
  "meta": { "word_count": 223, "class_vocabulary_used": [...], ... },
  "teacher_notes": "Maria - Good work here. ...",
  "inline_issues": [
    { "category": "grammar", "text": "go", "start": 12, "end": 14,
      "correction": "went", "explanation": "..." }
  ]
}
```

### Errors
All error responses use `{ "error": { "code": "...", "message": "..." } }`.
Codes: `unauthorized` (401), `invalid_request` (400), `rate_limited` (429),
`grading_failed` (500), `upstream_timeout` (504).

Full contract in [docs/API.md](API.md). Postman collection at
[docs/grading-api.postman.json](grading-api.postman.json).

---

## Limits

| Limit | Value |
|---|---|
| Rate limit | 60 requests/minute/key |
| Essay length | 10,000 characters |
| Rubric list size | 150 items (vocab, grammar) |
| Batch size | 60 essays |
| Per-essay timeout | 120 seconds |

---

## What we're *not* shipping in v1

Intentional exclusions, listed so nobody asks for them mid-demo:

- **OAuth / multi-tenant key management.** Bearer API keys, issued out-of-band.
  One key per integration. Revocation is manual on our side for now.
- **Webhooks / async callbacks.** Batch endpoint streams via SSE; no queue/callback model.
- **Rubric storage on our side.** Every request carries its own inline rubric.
  If Akdmic wants hosted rubrics (`POST { rubricId, essay }`), that's v2.
- **Pre-rendered HTML.** An earlier iteration returned `formattedText` and
  `feedbackSummary` as HTML with our CSS classes. Removed — integrators
  building their own UI need structured data, not our styles. Use
  `inline_issues` (with character offsets) + `scores` to render your own.
- **Usage metering / billing infrastructure.** Out of scope for this phase.
  We'll watch OpenAI dashboard during the pilot; revenue share is a
  separate conversation.

---

## Integration path (suggested)

1. **Akdmic stores the API key** as an environment variable on the Akdmic backend.
   **Never ship it to the browser** — the key has no per-user scoping.
2. **Akdmic's frontend** sends essays to Akdmic's backend, which proxies to
   `/v1/grade` with the bearer token attached server-side.
3. **For a classroom-grading UX**, use `/v1/grade-batch` and stream
   per-essay results to the UI as each event arrives. Don't wait for the
   full batch.
4. **Error handling**: treat 429 (rate_limit) and 504 (upstream_timeout)
   as retryable with backoff. Treat 400/401 as caller-fixable. Treat
   500 as a "log and alert us" case.
5. **Rubric per class or per assignment**, not per student. Cache the
   rubric object; don't rebuild it for every essay.

---

## Anticipated questions (and answers)

### Scaling & reliability

**Q: What happens if we send 200 essays at once?**
A: The batch endpoint caps at 60 essays per request. For a classroom of 200,
split into 4 batches of 50. They can run concurrently from Akdmic's side —
the 60/min rate limit applies to HTTP requests, not essays, so 4 batch
calls in a minute is fine. Each batch will take ~5-8 minutes.

**Q: Your P90 is 10s per essay. We've got teachers who'd grade 200 essays
at a time. Is that really going to work?**
A: That's where the batch endpoint pays off. 200 essays in 4 parallel
batches of 50 = ~6 minutes wall time from the teacher's perspective, with
results streaming in as they complete. Teachers don't see a progress bar
counting from 0 to 200 — they see the first 2 results in ~12s, then a
steady feed.

**Q: What's your uptime story?**
A: Staging is on Vercel's free tier, which is not an SLA. Before a
production Akdmic integration, we'd move to a paid Vercel plan or Railway
($10-20/mo) with an uptime monitor. No SLA commitment yet — that's part
of the revenue-share conversation.

**Q: What happens if OpenAI goes down?**
A: Your request gets a `504 upstream_timeout` or `500 grading_failed`
depending on how it fails. Retry with backoff. For the demo, we don't
have a fallback grader — we're 100% dependent on OpenAI GPT-4o.

### Cost & commercials

**Q: How much does each grade cost you?**
A: About $0.0165 per essay at current GPT-4o pricing, measured over 63
grades today ($1.04 total spend). A 200-word essay is roughly 1,500 input
+ 800 output tokens. Longer essays cost proportionally more.

**Q: Will pricing be usage-based?**
A: That's the conversation we want to have. The unit economics are
clear: our floor is cost-per-grade + hosting. Above that is the deal.

**Q: Can we cache grading results?**
A: Yes, you can — and you should, if students re-submit identical drafts.
Cache key is a hash of `(essay + rubric)`. We don't cache on our side.

### Contract stability

**Q: How stable is this API? We don't want to rewrite our integration
in 3 months.**
A: The `/v1/` prefix is our commitment. We won't break the v1 shape.
If we need to change response fields, we'll ship `/v2/` alongside.
Today we deliberately *removed* four fields from our draft contract
(HTML rendering fields) because we realized integrators don't need them
and they forced us to render unnecessary work server-side. That's
the kind of cleanup we want to do *before* you build against it, not after.

**Q: Can we get a changelog?**
A: Not yet. For the pilot period, the contract is frozen at what
`docs/API.md` describes. We'll email any changes to your team directly.

### Security

**Q: Where does the essay data go?**
A: Essay text is sent to OpenAI's API for grading. OpenAI's data-use
policy applies — their default for API traffic is "not used for
training" but we've confirmed nothing in writing yet. **If Akdmic has
minors' data, this needs a DPA before production.**

**Q: Are requests logged?**
A: Yes, we log `{timestamp, apiClient, latencyMs, essayChars,
success, errorCode}` to stdout. We do NOT log essay content or student
names. The logs are retained by Vercel for ~7 days.

**Q: What if our API key leaks?**
A: Contact us and we'll rotate it. Keys are currently stored in an
environment variable server-side — rotating is a 5-minute config change.
No self-service yet.

### Feature gaps

**Q: Can we pass multiple rubrics in a batch (different assignments)?**
A: Not in v1. One rubric per `/v1/grade-batch` call. Split into multiple
calls if you have multiple assignments. Likely a v2 addition if it comes
up often.

**Q: Can the API grade non-English essays?**
A: Not targeted. The grader is built for ESL/EFL writing — English output
from non-native students. Spanish, French, or Mandarin essays will get a
response but the quality is untested and likely poor.

**Q: Do you handle plagiarism / AI-generated detection?**
A: No. That's out of scope. If Akdmic wants it, it's a separate service
to call in parallel.

**Q: Can we customize the scoring categories?**
A: Not in v1. The 7 categories (grammar, vocabulary, spelling, mechanics,
fluency, layout, content) are fixed, with fixed point allocations
summing to 100. If Akdmic needs custom rubric schemas, it's a significant
product decision we'd want to scope together.

**Q: Can we get the raw OpenAI prompt you're using?**
A: No — that's proprietary. We'll share enough detail for Akdmic to
understand the *behavior* (what categories, what error types we detect,
how CEFR level shifts expectations) without handing over the IP.

---

## Today's measurement artifacts

- `docs/demo-metrics-2026-04-22-stepA.md` — error-envelope compliance + sequential latency
- `docs/demo-metrics-2026-04-22-stepB.md` — cold start + batch streaming
- `docs/API.md` — full contract
- `docs/grading-api.postman.json` — importable Postman collection for hands-on testing

---

## Open items before production

1. **Uptime monitoring.** Free-tier UptimeRobot or Better Stack pinging
   a `/v1/health` endpoint we haven't built yet.
2. **Cost monitoring.** Alert when OpenAI spend exceeds $X/day.
3. **DPA with OpenAI** if Akdmic's users are minors.
4. **Production hosting plan.** Vercel paid tier or migrate to Railway.
5. **Key rotation process.** Currently manual; formalize before multi-customer.
