// src/services/gradingEventService.js
//
// Writes one row to grading_events per grading call — the durable event log
// behind the admin dashboard (cost / behavior / errors lenses).
//
// HARD RULE: logging must NEVER break grading. Every function here swallows its
// own errors and returns quietly. Callers should also fire-and-forget (not
// await in a way that can reject the request), but the internal try/catch is
// the real safety net.

import { computeCostUsd } from './costRates.js';

async function getPrisma() {
  try {
    const { prisma } = await import('../../lib/prisma.js');
    return prisma || null;
  } catch {
    return null;
  }
}

/**
 * Record a single grading event.
 *
 * @param {Object} args
 * @param {string|null} args.userId
 * @param {string|null} args.userEmail
 * @param {string}      args.action           - "grade" | "grade_batch"
 * @param {string|null} args.classProfileId
 * @param {string|null} args.studentNickname
 * @param {Object|null} args.usage            - { promptTokens, completionTokens, model }
 * @param {string}      args.status           - "success" | "error"
 * @param {string|null} args.errorMessage
 * @param {number|null} args.latencyMs
 */
export async function recordGradingEvent(args = {}) {
  try {
    const prisma = await getPrisma();
    if (!prisma?.grading_events) return; // DB unavailable — skip silently

    const {
      userId = null,
      userEmail = null,
      action = 'grade',
      classProfileId = null,
      studentNickname = null,
      usage = null,
      status = 'success',
      errorMessage = null,
      latencyMs = null,
    } = args;

    const promptTokens = Number(usage?.promptTokens) || 0;
    const completionTokens = Number(usage?.completionTokens) || 0;
    const model = usage?.model || null;
    const totalTokens = promptTokens + completionTokens;
    // Cost is computed against the reported model; computeCostUsd falls back to
    // the default model's rate when model is null/unknown so a real grade is
    // never logged at $0 cost.
    const costUsd = computeCostUsd(model, promptTokens, completionTokens);

    await prisma.grading_events.create({
      data: {
        userId,
        userEmail,
        action,
        classProfileId,
        studentNickname,
        model,
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd,
        status,
        // Truncate defensively — some errors carry huge stacks/strings.
        errorMessage: errorMessage ? String(errorMessage).slice(0, 2000) : null,
        latencyMs: latencyMs != null ? Math.round(latencyMs) : null,
      },
    });
  } catch (err) {
    // Never let logging failure surface to the caller.
    console.error('[GRADING_EVENT] Failed to record event (ignored):', err?.message);
  }
}
