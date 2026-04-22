# Grading API — Integration Guide

A stateless HTTP API for grading ESL/EFL student essays against a rubric.
Callers send an essay (or a batch of essays) plus an inline rubric; the API
returns scores, category-level feedback, inline error highlights, and
per-category band rationales.

**Base URL:** `<API_BASE_URL>` (issued per integration)
**Version:** `v1`
**Content type:** `application/json` on requests; JSON or `text/event-stream` on responses (see each endpoint).

---

## Authentication

All requests must include a bearer token:

```
Authorization: Bearer <YOUR_API_KEY>
```

Your API key is issued out-of-band. Treat it like a password:

- Store it in environment variables, not source control.
- Never expose it in client-side code or browser requests. This API is intended to be called from your server.
- If a key leaks, contact us to rotate it.

A missing, malformed, or unrecognized key returns `401 Unauthorized`.

---

## Endpoints

### `GET /v1/health` — Health check

Cheap liveness probe for uptime monitors. No authentication. No rate limit.
Does not touch the grading pipeline or the LLM. A successful response proves
the HTTP layer and routing are working.

```
GET <API_BASE_URL>/v1/health
```

**Response — 200 OK:**

```json
{
  "status": "ok",
  "uptimeSeconds": 418,
  "timestamp": "2026-04-22T17:05:12.481Z"
}
```

---

### `POST /v1/grade` — Grade a single essay

Returns a complete grading result as JSON. Typical latency is 10–30s per
essay, depending on length. The server applies a hard 120s timeout.

#### Request

```
POST <API_BASE_URL>/v1/grade
Authorization: Bearer <YOUR_API_KEY>
Content-Type: application/json
```

```json
{
  "essay": "Yesterday I go to the store with my friend...",
  "prompt": "Write about a recent experience. 30-60 words.",
  "studentNickname": "Maria",
  "rubric": {
    "cefrLevel": "B1",
    "vocabulary": ["crowded", "plans", "experience"],
    "grammar": ["past simple", "present perfect"],
    "requiredWordCountMin": 30,
    "requiredWordCountMax": 60,
    "temperature": 0
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `essay` | string | yes | The student's writing. Max 10,000 characters. |
| `prompt` | string | no | The assignment instructions. If it contains a word-count range, it will be auto-parsed. |
| `studentNickname` | string | no | Used to personalize `teacher_notes`. |
| `rubric` | object | yes | Inline rubric definition (see below). |

**Rubric fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `cefrLevel` | string | no | One of `A1`, `A2`, `B1`, `B2`, `C1`, `C2`. Defaults to `C1` if omitted. Governs expected sophistication in feedback. |
| `vocabulary` | string[] | no | Target vocabulary words the student should use. Max 150 items. Items starting with `#` are treated as section headers and excluded from matching. |
| `grammar` | string[] | no | Target grammar structures. Max 150 items. Same header convention as `vocabulary`. |
| `requiredWordCountMin` | integer | no | Minimum expected word count. Set alongside max to define a target range. Takes precedence over a range parsed from `prompt`. |
| `requiredWordCountMax` | integer | no | Maximum expected word count. |
| `temperature` | number | no | Scoring adjustment. Range `-5` to `+5`. Each `±1` shifts per-category scores by ±10% of that category's max. Default `0`. |

#### Response — 200 OK

```json
{
  "success": true,
  "scores": {
    "grammar":    { "points": 8,  "out_of": 15, "rationale": "..." },
    "vocabulary": { "points": 10, "out_of": 15, "rationale": "..." },
    "spelling":   { "points": 15, "out_of": 15, "rationale": "..." },
    "mechanics":  { "points": 12, "out_of": 15, "rationale": "..." },
    "fluency":    { "points": 7,  "out_of": 10, "rationale": "..." },
    "layout":     { "points": 13, "out_of": 15, "rationale": "..." },
    "content":    { "points": 13, "out_of": 15, "rationale": "..." }
  },
  "total": { "points": 78, "out_of": 100 },
  "overallScore": 78,
  "meta": {
    "word_count": 45,
    "class_vocabulary_used": ["crowded", "plans"],
    "grammar_structures_used": ["past simple"],
    "transition_words_found": ["however"]
  },
  "teacher_notes": "Maria - Good work here. Let's work on grammar...",
  "inline_issues": [
    {
      "category": "grammar",
      "text": "go",
      "start": 12,
      "end": 14,
      "correction": "went",
      "explanation": "Use past tense for actions completed in the past."
    }
  ]
}
```

`overallScore` is a convenience alias for `total.points`. Use either.

**How to render the highlighted essay:** use `inline_issues`. Each entry
has `start` and `end` character offsets into the original essay text, plus
the error `category`, the proposed `correction`, and an `explanation`.
Render the highlights in your own styling.

---

### `POST /v1/grade-batch` — Grade a batch of essays (streaming)

For grading a whole classroom (up to 60 essays) in a single call. Responds
with Server-Sent Events so your UI can render results progressively rather
than waiting for the full batch to complete.

Essays are graded two-at-a-time in parallel on the server to stay within
OpenAI rate limits. A 30-essay batch typically completes in 3–5 minutes.

#### Request

```
POST <API_BASE_URL>/v1/grade-batch
Authorization: Bearer <YOUR_API_KEY>
Content-Type: application/json
```

```json
{
  "essays": [
    { "id": "student-maria", "essay": "...", "studentNickname": "Maria" },
    { "id": "student-jose",  "essay": "...", "studentNickname": "Jose" }
  ],
  "prompt": "Write about a recent experience. 30-60 words.",
  "rubric": {
    "cefrLevel": "B1",
    "vocabulary": ["crowded", "plans"],
    "grammar": ["past simple"],
    "requiredWordCountMin": 30,
    "requiredWordCountMax": 60
  }
}
```

**Top-level fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `essays` | object[] | yes | 1–60 essay objects. |
| `prompt` | string | no | Shared across all essays. |
| `rubric` | object | yes | Shared across all essays. Same shape as `/v1/grade`. |

**Per-essay object fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `essay` | string | yes | The student's writing. Max 10,000 characters. |
| `id` | string | no | Your stable identifier for this essay. Echoed back on every event so you can correlate results to students in your system. |
| `studentNickname` | string | no | Used to personalize feedback for this student. |

#### Response — 200 OK, `Content-Type: text/event-stream`

Events arrive as `data: <json>\n\n` lines. Five event types:

**`start`** — emitted once at the beginning.

```json
{ "type": "start", "totalEssays": 30, "totalBatches": 15, "message": "..." }
```

**`processing`** — emitted for each essay when its grading begins (at the
start of the 2-essay batch it belongs to).

```json
{
  "type": "processing",
  "index": 0,
  "id": "student-maria",
  "studentName": "student-maria",
  "batch": 1,
  "totalBatches": 15
}
```

**`result`** — emitted as each essay's grading completes. On success,
contains the full grading payload under `result` (same shape as `/v1/grade`
response). On failure, contains `success: false` and an `error` string —
**other essays continue processing**; one failure does not abort the batch.

```json
{
  "type": "result",
  "index": 0,
  "id": "student-maria",
  "success": true,
  "studentName": "student-maria",
  "studentNickname": "Maria",
  "result": { "scores": {...}, "total": {...}, "meta": {...}, ... }
}
```

```json
{
  "type": "result",
  "index": 3,
  "id": "student-alex",
  "success": false,
  "error": "OpenAI request failed: timeout"
}
```

**`complete`** — emitted once when all essays have been processed.

```json
{
  "type": "complete",
  "totalEssays": 30,
  "totalBatches": 15,
  "totalTimeSeconds": "218.4",
  "message": "All 30 essays processed in 15 batches"
}
```

**`error`** — emitted only on a fatal error (e.g., the whole batch dies
before any essay can be graded). Single-essay failures are reported via
`result` events, not this.

```json
{ "type": "error", "error": { "code": "grading_failed", "message": "..." } }
```

#### Consumption example (Node, `fetch` + streaming)

```js
const res = await fetch(`${API_BASE_URL}/v1/grade-batch`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ essays, prompt, rubric }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  const lines = buffer.split('\n\n');
  buffer = lines.pop(); // incomplete trailing chunk

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const event = JSON.parse(line.slice(6));
    switch (event.type) {
      case 'start':      /* initialize progress UI */ break;
      case 'processing': /* mark essay as in-flight */ break;
      case 'result':     /* render per-essay result */ break;
      case 'complete':   /* finalize */ break;
      case 'error':      /* show fatal error */ break;
    }
  }
}
```

---

## Error codes

All error responses share this envelope:

```json
{ "error": { "code": "<code>", "message": "<human-readable>" } }
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `invalid_request` | Malformed JSON, missing required field, value out of range, essay over 10,000 chars, rubric list over 150 items, batch over 60 essays |
| 401 | `unauthorized` | Missing/malformed `Authorization` header or unrecognized key |
| 429 | `rate_limited` | Rate limit exceeded (see Limits below) |
| 500 | `grading_failed` | Internal error during grading. Safe to retry once |
| 504 | `upstream_timeout` | Grading exceeded the 120s per-essay timeout. Safe to retry |

For `/v1/grade-batch`, per-essay failures arrive as `result` events with
`success: false`, not as HTTP errors. HTTP-level errors (400/401/429) from
`/v1/grade-batch` are returned as JSON before the SSE stream begins.

---

## Limits

| Limit | Value | Notes |
|---|---|---|
| Rate limit | 60 requests / minute / API key | Applies to the number of HTTP requests, not essays. A batch of 30 essays counts as 1 request. |
| Essay length | 10,000 characters | Per essay. Applies to both endpoints. |
| Rubric list size | 150 items | Applies to both `vocabulary` and `grammar`. |
| Batch size | 60 essays | Per `/v1/grade-batch` call. |
| Per-essay timeout | 120 seconds | Hard server-side timeout. |
| Request body | 10 MB | Sufficient for 60 essays at max length. |

Rate-limit responses include standard `RateLimit-*` response headers so you
can self-throttle:

```
RateLimit-Limit: 60
RateLimit-Remaining: 42
RateLimit-Reset: 23
```

---

## Quick start (curl)

Single essay:

```
curl -X POST <API_BASE_URL>/v1/grade \
  -H "Authorization: Bearer <YOUR_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "essay": "Yesterday I go to the store with my friend. We had a good time.",
    "prompt": "Write about a recent experience. 15-40 words.",
    "rubric": {
      "cefrLevel": "B1",
      "vocabulary": ["crowded"],
      "grammar": ["past simple"],
      "requiredWordCountMin": 15,
      "requiredWordCountMax": 40
    }
  }'
```

Batch (with `-N` to see streaming output):

```
curl -N -X POST <API_BASE_URL>/v1/grade-batch \
  -H "Authorization: Bearer <YOUR_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "essays": [
      { "id": "s1", "essay": "Yesterday I go to the park." },
      { "id": "s2", "essay": "My favorite hobby is cooking." }
    ],
    "prompt": "Write about something you enjoy. 10-30 words.",
    "rubric": { "cefrLevel": "B1" }
  }'
```

---

## Support

Questions, bug reports, or key rotation requests: contact the grading-tool
team directly. Include request timestamps (ISO 8601, UTC) when reporting
grading issues so we can cross-reference server logs.
