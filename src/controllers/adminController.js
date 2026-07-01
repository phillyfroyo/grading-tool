// src/controllers/adminController.js
//
// Read-only aggregate queries over grading_events, powering the three admin
// dashboard lenses:
//   1. Cost      — total spend, spend over time, spend by user / model
//   2. Behavior  — grades over time, active users, per-user activity
//   3. Errors    — error rate, recent failures, avg latency
//
// All handlers are gated by requireAdmin (see middleware/adminAuth.js).

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
