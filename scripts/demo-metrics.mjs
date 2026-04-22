#!/usr/bin/env node
/**
 * demo-metrics.mjs
 *
 * Drives the public grading API through a battery of calls to produce a
 * markdown report covering:
 *   - error-envelope behavior across the documented 4xx cases
 *   - cold-start latency vs warm latency
 *   - sequential single-grade latency distribution (P50, P90, mean)
 *   - /v1/grade-batch streaming cadence
 *
 * Reads GRADING_API_URL and GRADING_API_KEY from the project .env.
 *
 * Usage:
 *   node scripts/demo-metrics.mjs                  # all phases
 *   node scripts/demo-metrics.mjs --skip-cold      # skip the 10-min wait
 *   node scripts/demo-metrics.mjs --phase=1,3      # run only listed phases
 *   node scripts/demo-metrics.mjs --out=<path>     # custom report path
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import dotenv from 'dotenv';
import { essays, rubric, prompt } from './metrics-fixtures/essays.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..');

dotenv.config({ path: join(REPO_ROOT, '.env') });

const API_URL = process.env.GRADING_API_URL;
const API_KEY = process.env.GRADING_API_KEY;

if (!API_URL || !API_KEY) {
  console.error(
    'ERROR: GRADING_API_URL and GRADING_API_KEY must be set in .env'
  );
  process.exit(1);
}

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const skipCold = args.includes('--skip-cold');
const phaseArg = args.find((a) => a.startsWith('--phase='));
const phases = phaseArg
  ? phaseArg.replace('--phase=', '').split(',').map(Number)
  : [1, 2, 3, 4];
const outArg = args.find((a) => a.startsWith('--out='));
const reportPath =
  outArg?.replace('--out=', '') ||
  join(REPO_ROOT, 'docs', `demo-metrics-${new Date().toISOString().slice(0, 10)}.md`);

// ── helpers ──────────────────────────────────────────────────────────────────
const pct = (arr, p) => {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
};

const mean = (arr) =>
  arr.length === 0 ? null : arr.reduce((s, x) => s + x, 0) / arr.length;

const fmtMs = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(2)}s`);

const nowIso = () => new Date().toISOString();

async function gradeOne({ essay, nickname, rubricOverride, skipAuth, badKey, overrideBody, overrideHeaders }) {
  const url = `${API_URL}/v1/grade`;
  const headers = overrideHeaders ?? {
    'Content-Type': 'application/json',
  };
  if (!skipAuth) {
    headers['Authorization'] = `Bearer ${badKey ?? API_KEY}`;
  }
  const body =
    overrideBody !== undefined
      ? overrideBody
      : JSON.stringify({
          essay,
          prompt,
          studentNickname: nickname,
          rubric: rubricOverride ?? rubric,
        });

  const started = Date.now();
  let status, json, text;
  try {
    const res = await fetch(url, { method: 'POST', headers, body });
    status = res.status;
    text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      durationMs: Date.now() - started,
      error: String(err),
    };
  }
  return {
    ok: status >= 200 && status < 300,
    status,
    durationMs: Date.now() - started,
    body: json,
    rawBody: text,
  };
}

// ── Phase 1: error probes ────────────────────────────────────────────────────
async function runErrorProbes() {
  console.log('\n━━━ Phase 1: error probes ━━━');
  const cases = [
    {
      name: 'Missing Authorization header',
      expectStatus: 401,
      call: () =>
        gradeOne({ essay: essays[0].text, nickname: 'Maria', skipAuth: true }),
    },
    {
      name: 'Bad bearer token',
      expectStatus: 401,
      call: () =>
        gradeOne({ essay: essays[0].text, nickname: 'Maria', badKey: 'not-a-real-key' }),
    },
    {
      name: 'Missing essay field',
      expectStatus: 400,
      call: () =>
        gradeOne({
          overrideBody: JSON.stringify({ prompt, rubric }),
        }),
    },
    {
      name: 'Essay over 10,000 chars',
      expectStatus: 400,
      call: () =>
        gradeOne({
          essay: 'word '.repeat(2100).trim(),
          nickname: 'Overflow',
        }),
    },
    {
      name: 'Rubric vocabulary over 150 items',
      expectStatus: 400,
      call: () =>
        gradeOne({
          essay: essays[0].text,
          nickname: 'Maria',
          rubricOverride: {
            ...rubric,
            vocabulary: Array.from({ length: 151 }, (_, i) => `word${i}`),
          },
        }),
    },
    {
      name: 'Malformed JSON body',
      expectStatus: 400,
      call: () =>
        gradeOne({
          overrideHeaders: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_KEY}`,
          },
          overrideBody: '{ this is not valid json',
        }),
    },
  ];

  const results = [];
  for (const c of cases) {
    process.stdout.write(`  • ${c.name} ... `);
    const r = await c.call();
    const match = r.status === c.expectStatus;
    const code = r.body?.error?.code ?? '(no error.code)';
    const msg = r.body?.error?.message ?? '(no error.message)';
    console.log(
      `${match ? 'OK' : 'UNEXPECTED'} — HTTP ${r.status} (expected ${c.expectStatus}), code="${code}", ${fmtMs(r.durationMs)}`
    );
    results.push({
      name: c.name,
      expected: c.expectStatus,
      actual: r.status,
      match,
      code,
      message: msg,
      durationMs: r.durationMs,
    });
    await sleep(250);
  }
  return results;
}

// ── Phase 2: cold start ──────────────────────────────────────────────────────
async function runColdStart({ skipCold }) {
  console.log('\n━━━ Phase 2: cold start ━━━');
  const target = essays.find((e) => e.bucket === 'medium');
  console.log(`  Fixture: ${target.id} (~${target.text.split(/\s+/).length} words)`);

  console.log(`  Firing initial call at ${nowIso()} ...`);
  const first = await gradeOne({ essay: target.text, nickname: target.nickname });
  console.log(`  → HTTP ${first.status}, ${fmtMs(first.durationMs)}`);

  if (skipCold) {
    console.log('  --skip-cold set; skipping the 10-min idle wait.');
    return { first, second: null, skipped: true };
  }

  const waitMs = 10 * 60 * 1000;
  console.log(`  Idling ${waitMs / 60000} min to let Vercel function go cold ...`);
  await sleep(waitMs);

  console.log(`  Firing post-idle call at ${nowIso()} ...`);
  const second = await gradeOne({ essay: target.text, nickname: target.nickname });
  console.log(`  → HTTP ${second.status}, ${fmtMs(second.durationMs)}`);

  return { first, second, skipped: false };
}

// ── Phase 3: sequential warm grades ──────────────────────────────────────────
async function runSequential() {
  console.log('\n━━━ Phase 3: sequential warm grades ━━━');
  console.log(`  ${essays.length} essays, 1.1s delay between requests.`);
  const results = [];
  const start = Date.now();

  for (const [i, e] of essays.entries()) {
    process.stdout.write(
      `  [${String(i + 1).padStart(2)}/${essays.length}] ${e.id.padEnd(10)} (${e.bucket.padEnd(6)}) ... `
    );
    const r = await gradeOne({ essay: e.text, nickname: e.nickname });
    const score = r.body?.overallScore ?? '—';
    console.log(
      `HTTP ${r.status}, ${fmtMs(r.durationMs)}, score=${score}`
    );
    results.push({
      id: e.id,
      bucket: e.bucket,
      ok: r.ok,
      status: r.status,
      durationMs: r.durationMs,
      overallScore: r.body?.overallScore ?? null,
      wordCount: r.body?.meta?.word_count ?? null,
      errorCode: r.body?.error?.code ?? null,
    });
    if (i < essays.length - 1) await sleep(1100);
  }

  const totalMs = Date.now() - start;
  const ok = results.filter((r) => r.ok);
  const durations = ok.map((r) => r.durationMs);

  const byBucket = {};
  for (const r of ok) {
    (byBucket[r.bucket] ??= []).push(r.durationMs);
  }

  return {
    results,
    totalMs,
    successful: ok.length,
    failed: results.length - ok.length,
    p50: pct(durations, 50),
    p90: pct(durations, 90),
    mean: mean(durations),
    min: durations.length ? Math.min(...durations) : null,
    max: durations.length ? Math.max(...durations) : null,
    byBucket: Object.fromEntries(
      Object.entries(byBucket).map(([k, v]) => [
        k,
        {
          n: v.length,
          p50: pct(v, 50),
          p90: pct(v, 90),
          mean: mean(v),
        },
      ])
    ),
  };
}

// ── Phase 4: batch streaming ─────────────────────────────────────────────────
async function runBatch() {
  console.log('\n━━━ Phase 4: /v1/grade-batch streaming ━━━');
  console.log(`  Sending all ${essays.length} essays in one batch call.`);

  const url = `${API_URL}/v1/grade-batch`;
  const body = JSON.stringify({
    essays: essays.map((e) => ({
      id: e.id,
      essay: e.text,
      studentNickname: e.nickname,
    })),
    prompt,
    rubric,
  });

  const startedIso = nowIso();
  const start = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body,
  });

  console.log(`  HTTP ${res.status} at ${startedIso}`);
  if (res.status !== 200) {
    const txt = await res.text();
    return { ok: false, status: res.status, body: txt, startedIso };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events = [];
  let firstResultAt = null;
  const resultTimestamps = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop();
    for (const line of parts) {
      if (!line.startsWith('data: ')) continue;
      try {
        const ev = JSON.parse(line.slice(6));
        const offsetMs = Date.now() - start;
        events.push({ type: ev.type, offsetMs, raw: ev });
        if (ev.type === 'result') {
          if (firstResultAt == null) firstResultAt = offsetMs;
          resultTimestamps.push(offsetMs);
          const ok = ev.success;
          console.log(
            `  [${String(events.filter((e) => e.type === 'result').length).padStart(2)}/${essays.length}] +${(offsetMs / 1000).toFixed(1)}s ${ev.id?.padEnd(10) ?? '?'} ${ok ? 'ok' : 'FAIL'} score=${ev.result?.overallScore ?? '—'}`
          );
        } else {
          console.log(`  · +${(offsetMs / 1000).toFixed(1)}s event: ${ev.type}`);
        }
      } catch {
        /* ignore parse failure for ping/keepalive lines */
      }
    }
  }

  const totalMs = Date.now() - start;
  const successfulResults = events.filter(
    (e) => e.type === 'result' && e.raw.success
  );
  const failedResults = events.filter(
    (e) => e.type === 'result' && !e.raw.success
  );
  const interArrival = [];
  for (let i = 1; i < resultTimestamps.length; i++) {
    interArrival.push(resultTimestamps[i] - resultTimestamps[i - 1]);
  }

  return {
    ok: true,
    startedIso,
    totalMs,
    firstResultAt,
    resultCount: resultTimestamps.length,
    successful: successfulResults.length,
    failed: failedResults.length,
    interArrival: {
      p50: pct(interArrival, 50),
      p90: pct(interArrival, 90),
      mean: mean(interArrival),
      min: interArrival.length ? Math.min(...interArrival) : null,
      max: interArrival.length ? Math.max(...interArrival) : null,
    },
    firstAndLastSuccess:
      events.find((e) => e.type === 'complete')?.raw ?? null,
  };
}

// ── Report writer ────────────────────────────────────────────────────────────
function writeReport({ phase1, phase2, phase3, phase4, runStart, runEnd }) {
  const lines = [];
  lines.push(`# Grading API — Demo Metrics`);
  lines.push('');
  lines.push(`**Run window (UTC):** ${runStart} → ${runEnd}`);
  lines.push(`**Target:** \`${API_URL}\``);
  lines.push(`**Fixtures:** 20 synthetic B2 ESL essays (5 short / 10 medium / 5 long), shared inline rubric.`);
  lines.push(`**Caveat:** synthetic essays are cleaner than real student writing; latency numbers are a lower bound on real-world.`);
  lines.push('');

  if (phase1) {
    lines.push(`## Phase 1 — Error envelopes`);
    lines.push('');
    lines.push(`| Case | Expected | Actual | Match | \`error.code\` | Latency |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const r of phase1) {
      lines.push(
        `| ${r.name} | ${r.expected} | ${r.actual} | ${r.match ? '✓' : '✗'} | \`${r.code}\` | ${fmtMs(r.durationMs)} |`
      );
    }
    lines.push('');
  }

  if (phase2) {
    lines.push(`## Phase 2 — Cold start`);
    lines.push('');
    if (phase2.skipped) {
      lines.push(`Skipped (\`--skip-cold\`). Baseline warm call: ${fmtMs(phase2.first?.durationMs)}`);
    } else {
      const delta = phase2.second.durationMs - phase2.first.durationMs;
      lines.push(`- First call (possibly cold): **${fmtMs(phase2.first.durationMs)}** (HTTP ${phase2.first.status})`);
      lines.push(`- After 10-min idle: **${fmtMs(phase2.second.durationMs)}** (HTTP ${phase2.second.status})`);
      lines.push(`- Delta: ${delta >= 0 ? '+' : ''}${(delta / 1000).toFixed(2)}s`);
      lines.push('');
      if (delta > 3000) {
        lines.push(`> ⚠️ 10-min idle added >3s to the next call — cold-start exposure is real for demo day. Consider a pre-demo warm-up ping.`);
      } else {
        lines.push(`> Idle didn't meaningfully penalize the next call. Vercel likely kept the function warm during the wait.`);
      }
    }
    lines.push('');
  }

  if (phase3) {
    lines.push(`## Phase 3 — Sequential single-grade latency`);
    lines.push('');
    lines.push(`${phase3.successful} succeeded, ${phase3.failed} failed. Wall time: ${fmtMs(phase3.totalMs)}.`);
    lines.push('');
    lines.push(`| Stat | Value |`);
    lines.push(`|---|---|`);
    lines.push(`| P50 | **${fmtMs(phase3.p50)}** |`);
    lines.push(`| P90 | **${fmtMs(phase3.p90)}** |`);
    lines.push(`| Mean | ${fmtMs(phase3.mean)} |`);
    lines.push(`| Min | ${fmtMs(phase3.min)} |`);
    lines.push(`| Max | ${fmtMs(phase3.max)} |`);
    lines.push('');
    lines.push(`**By bucket:**`);
    lines.push('');
    lines.push(`| Bucket | N | P50 | P90 | Mean |`);
    lines.push(`|---|---|---|---|---|`);
    for (const [k, v] of Object.entries(phase3.byBucket)) {
      lines.push(`| ${k} | ${v.n} | ${fmtMs(v.p50)} | ${fmtMs(v.p90)} | ${fmtMs(v.mean)} |`);
    }
    lines.push('');
    lines.push(`<details><summary>Per-essay detail</summary>`);
    lines.push('');
    lines.push(`| # | ID | Bucket | HTTP | Latency | Score | Word ct |`);
    lines.push(`|---|---|---|---|---|---|---|`);
    for (const [i, r] of phase3.results.entries()) {
      lines.push(
        `| ${i + 1} | ${r.id} | ${r.bucket} | ${r.status} | ${fmtMs(r.durationMs)} | ${r.overallScore ?? '—'} | ${r.wordCount ?? '—'} |`
      );
    }
    lines.push('');
    lines.push(`</details>`);
    lines.push('');
  }

  if (phase4) {
    lines.push(`## Phase 4 — Batch streaming (\`/v1/grade-batch\`)`);
    lines.push('');
    if (!phase4.ok) {
      lines.push(`Batch call failed: HTTP ${phase4.status}.`);
    } else {
      lines.push(`- Total wall time: **${fmtMs(phase4.totalMs)}**`);
      lines.push(`- Time to first \`result\` event: **${fmtMs(phase4.firstResultAt)}**`);
      lines.push(`- Results received: ${phase4.resultCount} (${phase4.successful} ok, ${phase4.failed} fail)`);
      lines.push(`- Inter-result gap — P50: ${fmtMs(phase4.interArrival.p50)}, P90: ${fmtMs(phase4.interArrival.p90)}, mean: ${fmtMs(phase4.interArrival.mean)}`);
      lines.push('');
      lines.push(`Batch graded ${phase4.successful} essays in ${fmtMs(phase4.totalMs)} — ~${(phase4.totalMs / phase4.successful / 1000).toFixed(2)}s per essay amortized (vs. sequential P50 above). That ratio is your concurrency-win argument for the meeting.`);
    }
    lines.push('');
  }

  lines.push(`## Cost sidebar`);
  lines.push('');
  lines.push(`The script can't pull OpenAI costs programmatically. Cross-reference the OpenAI dashboard for the time window above (${runStart} → ${runEnd}) and divide total cost by number of essays graded to get cost-per-grade. Record both the single-grade phase and the batch phase — they should be similar since the underlying LLM call is the same.`);
  lines.push('');

  const content = lines.join('\n');
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, content);
  console.log(`\n✓ Report written: ${reportPath}`);
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  const runStart = nowIso();
  console.log(`Demo metrics run — started ${runStart}`);
  console.log(`Target: ${API_URL}`);
  console.log(`Phases: ${phases.join(', ')}${skipCold ? ' (cold-start wait skipped)' : ''}`);

  const out = { runStart };
  if (phases.includes(1)) out.phase1 = await runErrorProbes();
  if (phases.includes(2)) out.phase2 = await runColdStart({ skipCold });
  if (phases.includes(3)) out.phase3 = await runSequential();
  if (phases.includes(4)) out.phase4 = await runBatch();
  out.runEnd = nowIso();

  writeReport(out);
  console.log(`\nRun complete. Pull OpenAI dashboard cost between ${out.runStart} and ${out.runEnd}.`);
})().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
