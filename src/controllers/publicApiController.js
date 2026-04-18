/**
 * Public API controller for POST /v1/grade.
 *
 * Accepts a stateless grading request: essay + inline rubric. No DB lookup,
 * no session, no user context. Designed for external platforms (Akdmic,
 * Cuentana) to integrate without needing grading-tool accounts.
 *
 * Keeps the response shape identical to the session-based /api/grade
 * endpoint so downstream callers get the same grading data.
 */

import { gradeEssaySimple } from '../../grader/grader-simple.js';
import { applyTemperatureAdjustment } from '../services/temperatureService.js';

const MAX_ESSAY_CHARS = 10_000;
const MAX_RUBRIC_LIST_ITEMS = 500;
const VALID_CEFR_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

function bad(res, message) {
  return res.status(400).json({
    error: { code: 'invalid_request', message },
  });
}

function validateAndBuildProfile(body) {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body must be a JSON object' };
  }

  const { essay, prompt, rubric, studentNickname } = body;

  if (typeof essay !== 'string' || essay.trim().length === 0) {
    return { error: 'essay is required and must be a non-empty string' };
  }
  if (essay.length > MAX_ESSAY_CHARS) {
    return { error: `essay exceeds max length of ${MAX_ESSAY_CHARS} characters` };
  }

  if (prompt !== undefined && typeof prompt !== 'string') {
    return { error: 'prompt must be a string when provided' };
  }

  if (!rubric || typeof rubric !== 'object' || Array.isArray(rubric)) {
    return { error: 'rubric is required and must be an object' };
  }

  const {
    cefrLevel,
    vocabulary,
    grammar,
    requiredWordCountMin,
    requiredWordCountMax,
    temperature,
  } = rubric;

  if (cefrLevel !== undefined && !VALID_CEFR_LEVELS.has(cefrLevel)) {
    return { error: `rubric.cefrLevel must be one of: ${[...VALID_CEFR_LEVELS].join(', ')}` };
  }

  for (const [field, value] of [['vocabulary', vocabulary], ['grammar', grammar]]) {
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      return { error: `rubric.${field} must be an array of strings when provided` };
    }
    if (value.length > MAX_RUBRIC_LIST_ITEMS) {
      return { error: `rubric.${field} exceeds max length of ${MAX_RUBRIC_LIST_ITEMS} items` };
    }
    if (!value.every((v) => typeof v === 'string')) {
      return { error: `rubric.${field} must contain only strings` };
    }
  }

  for (const [field, value] of [
    ['requiredWordCountMin', requiredWordCountMin],
    ['requiredWordCountMax', requiredWordCountMax],
  ]) {
    if (value === undefined || value === null) continue;
    if (!Number.isInteger(value) || value < 0) {
      return { error: `rubric.${field} must be a non-negative integer when provided` };
    }
  }

  if (temperature !== undefined) {
    if (typeof temperature !== 'number' || temperature < -5 || temperature > 5) {
      return { error: 'rubric.temperature must be a number between -5 and 5 when provided' };
    }
  }

  if (studentNickname !== undefined && typeof studentNickname !== 'string') {
    return { error: 'studentNickname must be a string when provided' };
  }

  // Build a classProfile-shaped object that the internal grader expects.
  // Giving it a synthetic id/name keeps logging readable without touching the DB.
  const profileData = {
    id: `inline-${Date.now()}`,
    name: 'inline-rubric',
    cefrLevel: cefrLevel || 'C1',
    vocabulary: vocabulary || [],
    grammar: grammar || [],
    requiredWordCountMin: requiredWordCountMin ?? null,
    requiredWordCountMax: requiredWordCountMax ?? null,
    prompt: prompt || '',
    temperature: temperature ?? 0,
  };

  return {
    profileData,
    essay,
    prompt: prompt || '',
    studentNickname: studentNickname || null,
    temperature: temperature ?? 0,
  };
}

export async function handleGrade(req, res) {
  const startedAt = Date.now();
  const apiClient = req.apiClient || 'unknown';

  const parsed = validateAndBuildProfile(req.body);
  if (parsed.error) {
    logRequest({ apiClient, startedAt, essayChars: req.body?.essay?.length || 0, success: false, errorCode: 'invalid_request' });
    return bad(res, parsed.error);
  }

  try {
    const result = await gradeEssaySimple(
      parsed.essay,
      parsed.profileData,
      null,
      parsed.studentNickname,
    );

    if (!result || !result.scores || !result.total) {
      throw new Error('Incomplete grading result — missing scores or total');
    }

    const finalResult = applyTemperatureAdjustment(result, parsed.temperature);

    logRequest({
      apiClient,
      startedAt,
      essayChars: parsed.essay.length,
      success: true,
      errorCode: null,
    });

    return res.json({
      success: true,
      scores: finalResult.scores,
      total: finalResult.total,
      meta: finalResult.meta,
      teacher_notes: finalResult.teacher_notes,
      encouragement_next_steps: finalResult.encouragement_next_steps,
      inline_issues: finalResult.inline_issues,
      formattedText: finalResult.formattedText,
      feedbackSummary: finalResult.feedbackSummary,
      errors: finalResult.errors,
      overallScore: finalResult.overallScore,
      segments: finalResult.segments,
    });
  } catch (err) {
    console.error('[publicApi] Grading failed:', err);
    logRequest({
      apiClient,
      startedAt,
      essayChars: parsed.essay.length,
      success: false,
      errorCode: 'grading_failed',
    });
    return res.status(500).json({
      error: { code: 'grading_failed', message: err.message || 'Internal grading error' },
    });
  }
}

function logRequest({ apiClient, startedAt, essayChars, success, errorCode }) {
  const entry = {
    ts: new Date().toISOString(),
    apiClient,
    latencyMs: Date.now() - startedAt,
    essayChars,
    success,
    errorCode,
  };
  console.log('[publicApi]', JSON.stringify(entry));
}
