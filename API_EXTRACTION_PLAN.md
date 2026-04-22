# Grading API Extraction Plan

**Goal:** Wrap the grading pipeline in a standalone HTTP API so external platforms (Akdmic first, Cuentana for testing) can grade essays without needing access to the grading-tool codebase or UI.

**Primary use:** Dev experience + live demo for the Akdmic developer meeting in ~3 weeks. Not a production Akdmic integration yet — that comes after the meeting validates the approach.

**Non-goals for this phase:**
- Billing/metering infrastructure (revenue share is on the roadmap, not this sprint)
- Multi-tenant admin UI
- Migration of existing grading-tool users off the current UI

---

## 1. What We Already Have (The Good News)

The grading pipeline is already well-factored. Concretely:

- `grader/grader-simple.js:242` — `gradeEssaySimple(studentText, classProfile, …)` is the core function. Stateless given its inputs.
- `src/services/gradingService.js` — `gradeEssayUnified(...)` is the service layer wrapper.
- `src/controllers/gradingController.js:45` — `handleApiGrade` already implements most of what we need; it just requires a logged-in session and does a DB profile lookup.
- `src/routes/grading.js:26` — `POST /api/grade` already exists.

**Translation:** we are not building a grading engine. We're re-wrapping the one we already have behind a different auth model and a cleaner input contract.

---

## 2. The Contract (What External Callers Send & Receive)

### Endpoint

```
POST /v1/grade
Authorization: Bearer <api_key>
Content-Type: application/json
```

### Request body

```json
{
  "essay": "string — the student's writing",
  "prompt": "string — the assignment instructions (optional word count hint)",
  "rubric": {
    "cefrLevel": "B1 | B2 | C1",
    "vocabulary": ["list", "of", "target", "words"],
    "grammar": ["target grammar structures"],
    "requiredWordCountMin": 200,
    "requiredWordCountMax": 220,
    "temperature": 0
  },
  "studentNickname": "optional, used in feedback tone"
}
```

**Key design decision:** the caller passes the **rubric inline** rather than a profile ID. This removes the DB dependency entirely for the stateless API path and makes the contract portable. The grading-tool's own UI continues to use profile IDs internally — that's fine, it's a different consumer.

### Response body

Same shape as the current `handleApiGrade` response (scores, total, meta, teacher_notes, inline_issues, errors, overallScore). See `src/controllers/gradingController.js:74-87`.

### Error responses

```json
{ "error": { "code": "invalid_request", "message": "essay is required" } }
```

Standard HTTP codes: 400 (bad input), 401 (bad key), 429 (rate limit), 500 (server), 504 (upstream LLM timeout).

---

## 3. Work Breakdown (Code Changes)

### Phase A — API surface (~2–3 days)

1. **New route file: `src/routes/publicApi.js`**
   - `POST /v1/grade` — calls `gradeEssayUnified` directly with inline rubric, no DB lookup.
   - Uses a new `apiKeyAuth` middleware instead of `requireAuth`.

2. **New middleware: `src/middleware/apiKeyAuth.js`**
   - Reads `Authorization: Bearer <key>` header.
   - For v1: compare against a hashed key stored in an env var (`API_KEYS` as JSON: `{"akdmic_dev": "<hash>", "cuentana_dev": "<hash>"}`).
   - Attaches `req.apiClient = "akdmic_dev"` for logging.
   - Rejects with 401 on miss.
   - **Later upgrade:** move keys to DB with revocation + per-key rate limits.

3. **New controller: `src/controllers/publicApiController.js`**
   - Validates request body (essay length, rubric shape).
   - Builds an in-memory `profileData` object from the inline `rubric` field matching what `gradeEssayUnified` already expects.
   - Calls the service, returns the existing response shape.
   - Wraps errors in the new `{ error: { code, message } }` envelope.

4. **Mount in `server.js`** — register the new router. Keep existing session-based routes untouched.

5. **Request logging**
   - Log to stdout for now: `{ timestamp, apiClient, latencyMs, essayChars, success, errorCode }`.
   - Good enough for the meeting. Structured logging → DB/Datadog comes later.

### Phase B — Rate limiting & safety (~half day)

6. **Rate limit** with `express-rate-limit`: e.g. 60 req/min per API key. Prevents runaway costs from a bug in someone's integration loop.
7. **Input caps:** reject essays >10k chars or rubric vocabulary lists >500 items. Protects LLM cost.
8. **Timeout:** hard timeout of 60s on the grading call; return 504 if exceeded.

### Phase C — Docs & testability (~1 day)

9. **`docs/API.md`** — single-page contract: endpoint, auth, request, response, error codes, example `curl`. This is what you hand to Akdmic's devs.
10. **Postman/Thunder Client collection** checked in at `docs/grading-api.postman.json` — lets his devs click-to-test in the meeting.
11. **One integration test** hitting `/v1/grade` with a fixture essay. Lives in `src/__tests__/publicApi.test.js`.

### Phase D — Deployment (~half day)

12. **Environment:** the existing Vercel deployment can host this. The new route is additive; no infra change needed.
13. **Staging URL:** pick a subdomain like `api-staging.<yourdomain>` or use the Vercel preview URL for the Cuentana integration.
14. **Production URL:** defer until after the Akdmic meeting. Staging is enough for a live demo.

**Total estimate:** ~4–5 working days for Phases A–D. Leaves buffer in your 3-week window for Cuentana integration + meeting prep.

---

## 4. Third-Party Tools & Resources

**Already in the stack (no new deps needed for core work):**
- Express 5, OpenAI SDK, Prisma, Jest.

**New / confirm installed:**
- `express-rate-limit` — rate limiting. Tiny, well-maintained.
- `zod` (recommended) — request body validation. Clean error messages, worth the 10kb.

**External services:**
- **Hosting:** stay on Vercel for Phase A. If cold starts on serverless feel bad during the demo, move to Railway or Render ($5–10/month always-on). Decide after first Cuentana test call.
- **Monitoring:** Better Stack or UptimeRobot free tier — ping `/v1/health` every minute, alert on failure. Set this up the week of the meeting.
- **LLM:** existing OpenAI account. Usage will now be billed against API traffic; watch the dashboard after Cuentana is wired up.

**What we're explicitly not adding yet:**
- No dedicated API gateway (Kong, AWS API Gateway). Overkill for one endpoint, one customer.
- No OAuth. Bearer API keys are the industry norm for machine-to-machine at this scale.
- No DB-backed key store. Env var is fine for ≤5 keys.

---

## 5. Testing with Cuentana (Throwaway Branch)

**Principle:** zero risk to Cuentana prod or users. Everything stays on a branch, behind a feature flag if needed, and gets deleted or shelved after the Akdmic meeting.

### Setup

1. In the Cuentana repo:
   ```
   git checkout -b exp/grading-api-spike
   ```
   Name it something clearly throwaway.

2. Add a `.env.local` entry:
   ```
   GRADING_API_URL=https://<staging-vercel-url>/v1/grade
   GRADING_API_KEY=<cuentana_dev key>
   ```
   These never get committed. Add to `.gitignore` if not already.

3. Build a minimal "Writing Practice" page — one textarea, one submit button, one feedback display. Ugly is fine. This is a prototype, not a product.

### Integration shape

- Client submits essay → Cuentana backend → `fetch(GRADING_API_URL, { headers: { Authorization: \`Bearer ${GRADING_API_KEY}\` }, body: {...} })` → render response.
- Hardcode a rubric for testing (e.g. a B2 Spanish rubric with ~20 vocab words and 5 grammar structures). Don't build rubric management yet.

### What to deliberately observe (the real goal)

These are the things you'll want to speak to in the Akdmic meeting. Keep notes as you go:

- **Latency:** P50 and P90 round-trip time. Is it acceptable UX? Where is the time spent?
- **Error modes:** what happens when the API is down, slow, returns malformed JSON? Is the error handling ergonomic for the integrator?
- **Auth ergonomics:** did you fumble with the bearer header? Keys in env vars? Anything that annoyed you will annoy his devs worse.
- **Contract gaps:** any field you wished was in the request or response? Add to a "v1.1 wishlist" in this doc.
- **Cost per grade:** pull from OpenAI dashboard after ~20 test grades. This is the number you need for the revenue-share conversation.

### Tear-down

- Branch stays unmerged. After the meeting, either promote the learnings into a real Cuentana writing feature (separate project, clean branch) or abandon.
- Revoke the `cuentana_dev` API key on the grading-tool side after the meeting to prevent forgotten calls racking up LLM charges.

---

## 6. Open Questions (Decide Before Phase A)

1. **Key storage for v1:** env var (`API_KEYS` JSON) vs. a tiny `api_keys` Prisma table? Env var is faster to ship; table is better if we expect to issue/revoke keys before the next deploy. **Recommendation:** env var.
2. **Rubric passthrough vs. hosted rubrics:** do we want Akdmic to eventually have their rubrics stored on our side (so they POST `{ rubricId, essay }`)? For v1, inline rubric. Revisit after the meeting.
3. **Streaming response:** the existing app has a streaming batch endpoint. Worth exposing? Probably not for v1 — adds complexity, their integration likely doesn't need it.
4. **Response versioning:** lock the response shape behind `/v1/` so we can evolve without breaking callers. Already in the plan.

---

## 7. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| LLM cost spikes from a buggy caller loop | Medium | Rate limit + input caps (Phase B) |
| Vercel cold starts make demo feel slow | Medium | Warm-up ping before demo, or move to Railway |
| Akdmic devs hit an error case I didn't test | High | Ship the Postman collection; let them poke it before the meeting |
| OpenAI API outage during demo | Low | Have a pre-recorded fallback demo video |
| Contract change needed after meeting | High | That's fine — `/v1/` gives us room; plan a `/v2/` if needed |

---

## 8. Definition of Done (for this plan)

- [ ] `POST /v1/grade` deployed to staging and returns valid scores
- [ ] API key auth works and rejects missing/bad keys
- [ ] Rate limit, input caps, and timeout enforced
- [ ] `docs/API.md` and Postman collection committed
- [ ] Cuentana throwaway branch successfully grades 10+ essays end-to-end
- [ ] Latency, cost-per-grade, and error-mode notes captured for the meeting
