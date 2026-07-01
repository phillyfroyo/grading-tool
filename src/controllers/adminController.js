// src/controllers/adminController.js
//
// Read-only aggregate queries over grading_events, powering the three admin
// dashboard lenses:
//   1. Cost      — total spend, spend over time, spend by user / model
//   2. Behavior  — grades over time, active users, per-user activity
//   3. Errors    — error rate, recent failures, avg latency
//
// All handlers are gated by requireAdmin (see middleware/adminAuth.js).

import { campusForEmail, roleForEmail, isHiddenEmail, DEV_EMAIL } from '../services/campusMap.js';

async function getPrisma() {
  try {
    const { prisma } = await import('../../lib/prisma.js');
    return prisma || null;
  } catch {
    return null;
  }
}

/** Parse ?days=N (default 30, clamped 1..365) into a since-Date. */
function sinceFromQuery(req) {
  let days = parseInt(req.query.days, 10);
  if (!Number.isFinite(days) || days < 1) days = 30;
  if (days > 365) days = 365;
  return { days, since: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
}

function round(n, dp = 4) {
  const f = 10 ** dp;
  return Math.round((Number(n) || 0) * f) / f;
}

/** Fill in zero-activity days between since..now so the time axis is continuous. */
function fillDayGaps(bucketMap, days) {
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const k = d.toISOString().slice(0, 10);
    out.push(bucketMap.get(k) || { day: k, grades: 0, cost: 0, errors: 0 });
  }
  return out;
}

/**
 * GET /admin/api/summary?days=N
 * One call returning everything the dashboard needs. Aggregation is pushed into
 * the database (groupBy / aggregate / date_trunc) so we never pull the full row
 * set into the serverless function's heap — only bucketed summaries cross the
 * wire. This keeps the endpoint bounded as grading volume grows.
 */
export async function handleAdminSummary(req, res) {
  const prisma = await getPrisma();
  if (!prisma?.grading_events) {
    return res.status(503).json({ success: false, error: 'Database unavailable' });
  }

  const { days, since } = sinceFromQuery(req);
  const where = { createdAt: { gte: since } };

  try {
    // Run the independent aggregate queries concurrently.
    const [
      successAgg,          // totals over successful grades
      statusCounts,        // grades vs errors (for error rate)
      latencyAgg,          // avg latency over successes
      byModelRows,         // cost/tokens/grades grouped by model (success only)
      byDayRows,           // per-UTC-day grades/cost/errors (raw SQL)
      byUserRows,          // per-user grades/cost/tokens (raw SQL — handles null email)
      recentErrors,        // capped, newest-first (query-side limit)
      devAgg,              // the operator/dev account's cost, called out separately
    ] = await Promise.all([
      prisma.grading_events.aggregate({
        where: { ...where, status: 'success' },
        _count: { _all: true },
        _sum: { costUsd: true, totalTokens: true },
      }),
      prisma.grading_events.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      prisma.grading_events.aggregate({
        where: { ...where, status: 'success' },
        _avg: { latencyMs: true },
      }),
      prisma.grading_events.groupBy({
        by: ['model'],
        where: { ...where, status: 'success' },
        _count: { _all: true },
        _sum: { costUsd: true, totalTokens: true },
      }),
      prisma.$queryRaw`
        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
               COUNT(*) FILTER (WHERE status = 'success')            AS grades,
               COUNT(*) FILTER (WHERE status = 'error')              AS errors,
               COALESCE(SUM("costUsd") FILTER (WHERE status = 'success'), 0) AS cost
        FROM "grading_events"
        WHERE "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw`
        SELECT COALESCE("userEmail", "userId", 'unknown') AS user,
               COUNT(*) FILTER (WHERE status = 'success')  AS grades,
               COUNT(*) FILTER (WHERE status = 'error')    AS errors,
               COALESCE(SUM("costUsd")      FILTER (WHERE status = 'success'), 0) AS cost,
               COALESCE(SUM("totalTokens")  FILTER (WHERE status = 'success'), 0) AS tokens,
               MAX("createdAt")                            AS "lastActive"
        FROM "grading_events"
        WHERE "createdAt" >= ${since}
        GROUP BY 1 ORDER BY grades DESC LIMIT 200`,
      prisma.grading_events.findMany({
        where: { ...where, status: 'error' },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: { createdAt: true, userEmail: true, userId: true, action: true, errorMessage: true },
      }),
      prisma.grading_events.aggregate({
        where: { ...where, status: 'success', userEmail: DEV_EMAIL },
        _count: { _all: true },
        _sum: { costUsd: true },
      }),
    ]);

    const totalGrades = successAgg._count._all || 0;
    const totalCost = successAgg._sum.costUsd || 0;
    const totalTokens = successAgg._sum.totalTokens || 0;
    const errorCount = statusCounts.find(s => s.status === 'error')?._count._all || 0;
    const total = statusCounts.reduce((s, r) => s + (r._count._all || 0), 0);

    // BigInt from raw COUNT/SUM → Number. Postgres returns bigint for COUNT.
    const num = (v) => Number(v) || 0;

    const byDay = new Map();
    for (const r of byDayRows) {
      byDay.set(r.day, {
        day: r.day, grades: num(r.grades), errors: num(r.errors), cost: round(num(r.cost)),
      });
    }
    const overTime = fillDayGaps(byDay, days);

    const users = byUserRows.map(r => ({
      user: r.user,
      grades: num(r.grades),
      errors: num(r.errors),
      cost: round(num(r.cost)),
      tokens: num(r.tokens),
      lastActive: r.lastActive,
    }));

    const models = byModelRows
      .map(m => ({
        model: m.model || 'unknown',
        grades: m._count._all || 0,
        cost: round(m._sum.costUsd || 0),
        tokens: m._sum.totalTokens || 0,
      }))
      .sort((a, b) => b.cost - a.cost);

    return res.json({
      success: true,
      windowDays: days,
      generatedAt: new Date().toISOString(),
      totals: {
        grades: totalGrades,
        errors: errorCount,
        cost: round(totalCost),
        tokens: totalTokens,
        activeUsers: users.length,
        avgCostPerGrade: totalGrades ? round(totalCost / totalGrades) : 0,
        errorRate: total ? round(errorCount / total, 4) : 0,
        avgLatencyMs: latencyAgg._avg.latencyMs != null ? Math.round(latencyAgg._avg.latencyMs) : null,
        // Dev/operator account's own cost, called out separately (still included
        // in the `cost` total above).
        devCost: round(devAgg._sum.costUsd || 0),
        devGrades: devAgg._count._all || 0,
      },
      overTime,
      users,
      models,
      recentErrors: recentErrors.map(r => ({
        createdAt: r.createdAt,
        user: r.userEmail || r.userId || 'unknown',
        action: r.action,
        errorMessage: r.errorMessage,
      })),
    });
  } catch (error) {
    console.error('[ADMIN] Summary query failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/** Days since a date, or null. */
function daysSince(date) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / (24 * 60 * 60 * 1000));
}

// Window during which a not-yet-returned user is considered "New".
const NEW_WINDOW_DAYS = 42; // 6 weeks

/**
 * Engagement status for a user:
 *   'returning' — has come back at least once (activity on 2+ distinct days).
 *                 Monitored continuously; never expires.
 *   'new'       — not returning yet, but signed up within the last 6 weeks.
 *   null        — signed up >6 weeks ago and never returned (badge drops off).
 */
function engagementStatus({ activeDays, signupDate }) {
  if (activeDays >= 2) return 'returning';
  const since = daysSince(signupDate);
  if (since != null && since <= NEW_WINDOW_DAYS) return 'new';
  return null;
}

/**
 * GET /admin/api/users
 * The User-tab list: EVERY registered user (base = users table, so people who
 * haven't graded since instrumentation still appear), left-joined to their
 * grading_events aggregates. Numbered by signup order (#1 = earliest).
 *
 * "Returning" = has grading activity on 2+ distinct UTC days (a real repeat
 * user, not a one-session tryout). Cost/essays come from grading_events only,
 * so they read 0 until events accrue — accurate over invented history.
 */
export async function handleAdminUsers(req, res) {
  const prisma = await getPrisma();
  if (!prisma?.users) {
    return res.status(503).json({ success: false, error: 'Database unavailable' });
  }

  try {
    const users = await prisma.users.findMany({
      select: { id: true, email: true, createdAt: true },
      orderBy: { createdAt: 'asc' }, // #1 = earliest signup
    });

    // Per-user event aggregates (success grades only for cost/essays), plus the
    // count of distinct active days (for returning/one-time) and last activity.
    const agg = await prisma.$queryRaw`
      SELECT "userId",
             COUNT(*) FILTER (WHERE status = 'success')                        AS essays,
             COALESCE(SUM("costUsd") FILTER (WHERE status = 'success'), 0)     AS cost,
             COUNT(DISTINCT date_trunc('day', "createdAt"))                    AS active_days,
             MAX("createdAt")                                                  AS last_active
      FROM "grading_events"
      WHERE "userId" IS NOT NULL
      GROUP BY "userId"`;

    const byId = new Map();
    for (const r of agg) {
      byId.set(r.userId, {
        essays: Number(r.essays) || 0,
        cost: Number(r.cost) || 0,
        activeDays: Number(r.active_days) || 0,
        lastActive: r.last_active,
      });
    }

    // Drop hidden test accounts FIRST, then number the survivors. `users` is
    // already ordered by signup (createdAt asc), so numbering after the filter
    // keeps signup order but flows 1,2,3… with no gaps where a hidden account
    // sat (rather than skipping its number).
    const list = users
      .filter(u => !isHiddenEmail(u.email))
      .map((u, i) => {
        const a = byId.get(u.id) || { essays: 0, cost: 0, activeDays: 0, lastActive: null };
        return {
          num: i + 1,
          id: u.id,
          email: u.email,
          signupDate: u.createdAt,
          campus: campusForEmail(u.email), // null → "—" until the map is filled
          role: roleForEmail(u.email),     // 'dev' | 'akdmic' | null
          essays: a.essays,
          cost: round(a.cost),
          status: engagementStatus({ activeDays: a.activeDays, signupDate: u.createdAt }),
          lastActive: a.lastActive,
          lastActiveDaysAgo: daysSince(a.lastActive),
        };
      });

    return res.json({ success: true, count: list.length, users: list });
  } catch (error) {
    console.error('[ADMIN] Users query failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Cluster a chronological list of activity timestamps into "grading cycles".
 * The teacher grades in 1–3 day bursts every ~month, so any gap longer than
 * GAP_DAYS starts a new cycle. Returns cycle summaries newest-first.
 */
function computeCycles(timestamps, GAP_DAYS = 4) {
  const ts = timestamps
    .map(t => new Date(t).getTime())
    .filter(n => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (!ts.length) return [];
  const gapMs = GAP_DAYS * 24 * 60 * 60 * 1000;
  const cycles = [];
  let start = ts[0], prev = ts[0], count = 1;
  for (let i = 1; i < ts.length; i++) {
    if (ts[i] - prev > gapMs) {
      cycles.push({ start, end: prev, essays: count });
      start = ts[i]; count = 1;
    } else {
      count++;
    }
    prev = ts[i];
  }
  cycles.push({ start, end: prev, essays: count });
  return cycles
    .map(c => ({
      start: new Date(c.start).toISOString(),
      end: new Date(c.end).toISOString(),
      essays: c.essays,
      spanDays: Math.round((c.end - c.start) / (24 * 60 * 60 * 1000)) + 1,
    }))
    .reverse();
}

/**
 * GET /admin/api/users/:id
 * Side-panel detail for one user: cost breakdown, grading cycles (usage
 * pattern), and recency/returning info.
 */
export async function handleAdminUserDetail(req, res) {
  const prisma = await getPrisma();
  if (!prisma?.users) {
    return res.status(503).json({ success: false, error: 'Database unavailable' });
  }

  const { id } = req.params;

  try {
    const user = await prisma.users.findUnique({
      select: { id: true, email: true, createdAt: true },
      where: { id },
    });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // All successful grade timestamps for this user (for cost + cycles).
    const events = await prisma.grading_events.findMany({
      where: { userId: id, status: 'success' },
      select: { createdAt: true, costUsd: true, totalTokens: true },
      orderBy: { createdAt: 'asc' },
    });
    const errorCount = await prisma.grading_events.count({
      where: { userId: id, status: 'error' },
    });

    const essays = events.length;
    const totalCost = events.reduce((s, e) => s + (e.costUsd || 0), 0);
    const totalTokens = events.reduce((s, e) => s + (e.totalTokens || 0), 0);
    const cycles = computeCycles(events.map(e => e.createdAt));
    const firstActive = events.length ? events[0].createdAt : null;
    const lastActive = events.length ? events[events.length - 1].createdAt : null;
    // Distinct active days = same "returning" basis as the list (2+ days).
    const activeDays = new Set(events.map(e => new Date(e.createdAt).toISOString().slice(0, 10))).size;
    const status = engagementStatus({ activeDays, signupDate: user.createdAt });

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        campus: campusForEmail(user.email),
        role: roleForEmail(user.email),
        signupDate: user.createdAt,
      },
      cost: {
        total: round(totalCost),
        essays,
        avgPerEssay: essays ? round(totalCost / essays) : 0,
        tokens: totalTokens,
        errors: errorCount,
      },
      recency: {
        firstActive,
        lastActive,
        lastActiveDaysAgo: daysSince(lastActive),
        daysSinceSignup: daysSince(user.createdAt),
        status, // 'returning' | 'new' | null
      },
      cycles, // newest-first: { start, end, essays, spanDays }
      cycleCount: cycles.length,
    });
  } catch (error) {
    console.error('[ADMIN] User detail query failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
