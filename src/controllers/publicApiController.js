/**
 * Public API controller for POST /v1/grade and POST /v1/grade-batch.
 *
 * Stateless grading: essay(s) + inline rubric. No DB lookup, no session,
 * no user context. Single-essay path returns JSON; batch path streams SSE
 * so callers can render results progressively rather than waiting minutes
 * for a classroom to finish.
 */

import { gradeEssaySimple } from '../../grader/grader-simple.js';
import { applyTemperatureAdjustment } from '../services/temperatureService.js';
import { processBatchStreaming } from '../services/batchGradingService.js';

const MAX_ESSAY_CHARS = 10_000;
const MAX_RUBRIC_LIST_ITEMS = 150;
const GRADE_TIMEOUT_MS = 120_000;
const MAX_BATCH_ESSAYS = 60;
const VALID_CEFR_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

class GradingTimeoutError extends Error {
  constructor() {
    super('Grading timed out');
    this.name = 'GradingTimeoutError';
  }
}

function withTimeout(promise, ms) {
  let timerId;
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new GradingTimeoutError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timerId));
}

function bad(res, message) {
  return res.status(400).json({
    error: { code: 'invalid_request', message },
  });
}

function validateEssayField(essay, fieldLabel = 'essay') {
  if (typeof essay !== 'string' || essay.trim().length === 0) {
    return `${fieldLabel} is required and must be a non-empty string`;
  }
  if (essay.length > MAX_ESSAY_CHARS) {
    return `${fieldLabel} exceeds max length of ${MAX_ESSAY_CHARS} characters`;
  }
  return null;
}

function validateRubric(rubric, prompt) {
  if (prompt !== undefined && typeof prompt !== 'string') {
    return { error: 'prompt must be a string when provided' };
  }
  if (!rubric || typeof rubric !== 'object' || Array.isArray(rubric)) {
    return { error: 'rubric is required and must be an object' };
  }

  const { cefrLevel, vocabulary, grammar, requiredWordCountMin, requiredWordCountMax, temperature } = rubric;

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

  return {
    profileData: {
      id: `inline-${Date.now()}`,
      name: 'inline-rubric',
      cefrLevel: cefrLevel || 'C1',
      vocabulary: vocabulary || [],
      grammar: grammar || [],
      requiredWordCountMin: requiredWordCountMin ?? null,
      requiredWordCountMax: requiredWordCountMax ?? null,
      prompt: prompt || '',
      temperature: temperature ?? 0,
    },
    temperature: temperature ?? 0,
  };
}

function validateSingleGradeRequest(body) {
  if (!body || typeof body !== 'object') return { error: 'Request body must be a JSON object' };

  const essayError = validateEssayField(body.essay);
  if (essayError) return { error: essayError };

  if (body.studentNickname !== undefined && typeof body.studentNickname !== 'string') {
    return { error: 'studentNickname must be a string when provided' };
  }

  const rubricResult = validateRubric(body.rubric, body.prompt);
  if (rubricResult.error) return { error: rubricResult.error };

  return {
    essay: body.essay,
    prompt: body.prompt || '',
    studentNickname: body.studentNickname || null,
    profileData: rubricResult.profileData,
    temperature: rubricResult.temperature,
  };
}

function validateBatchGradeRequest(body) {
  if (!body || typeof body !== 'object') return { error: 'Request body must be a JSON object' };

  if (!Array.isArray(body.essays) || body.essays.length === 0) {
    return { error: 'essays is required and must be a non-empty array' };
  }
  if (body.essays.length > MAX_BATCH_ESSAYS) {
    return { error: `essays exceeds max batch size of ${MAX_BATCH_ESSAYS}` };
  }

  const normalizedEssays = [];
  for (let i = 0; i < body.essays.length; i++) {
    const e = body.essays[i];
    if (!e || typeof e !== 'object') {
      return { error: `essays[${i}] must be an object` };
    }
    const essayError = validateEssayField(e.essay, `essays[${i}].essay`);
    if (essayError) return { error: essayError };
    if (e.id !== undefined && typeof e.id !== 'string') {
      return { error: `essays[${i}].id must be a string when provided` };
    }
    if (e.studentNickname !== undefined && typeof e.studentNickname !== 'string') {
      return { error: `essays[${i}].studentNickname must be a string when provided` };
    }
    normalizedEssays.push({
      id: e.id || null,
      studentText: e.essay,
      studentName: e.id || `Essay ${i + 1}`,
      studentNickname: e.studentNickname || null,
    });
  }

  const rubricResult = validateRubric(body.rubric, body.prompt);
  if (rubricResult.error) return { error: rubricResult.error };

  return {
    essays: normalizedEssays,
    prompt: body.prompt || '',
    profileData: rubricResult.profileData,
    temperature: rubricResult.temperature,
  };
}

export async function handleGrade(req, res) {
  const startedAt = Date.now();
  const apiClient = req.apiClient || 'unknown';

  const parsed = validateSingleGradeRequest(req.body);
  if (parsed.error) {
    logRequest({ apiClient, startedAt, essayChars: req.body?.essay?.length || 0, success: false, errorCode: 'invalid_request' });
    return bad(res, parsed.error);
  }

  try {
    const result = await withTimeout(
      gradeEssaySimple(parsed.essay, parsed.profileData, null, parsed.studentNickname),
      GRADE_TIMEOUT_MS,
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
      inline_issues: finalResult.inline_issues,
      formattedText: finalResult.formattedText,
      feedbackSummary: finalResult.feedbackSummary,
      errors: finalResult.errors,
      overallScore: finalResult.overallScore,
      segments: finalResult.segments,
    });
  } catch (err) {
    if (err instanceof GradingTimeoutError) {
      logRequest({
        apiClient,
        startedAt,
        essayChars: parsed.essay.length,
        success: false,
        errorCode: 'upstream_timeout',
      });
      return res.status(504).json({
        error: { code: 'upstream_timeout', message: 'Grading timed out. Retry shortly.' },
      });
    }

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

export async function handleBatchGrade(req, res) {
  const startedAt = Date.now();
  const apiClient = req.apiClient || 'unknown';

  const parsed = validateBatchGradeRequest(req.body);
  if (parsed.error) {
    logRequest({
      apiClient,
      startedAt,
      essayChars: 0,
      success: false,
      errorCode: 'invalid_request',
    });
    return bad(res, parsed.error);
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const totalEssayChars = parsed.essays.reduce((sum, e) => sum + e.studentText.length, 0);
  const writeEvent = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  try {
    await processBatchStreaming({
      essays: parsed.essays,
      prompt: parsed.prompt,
      profileData: parsed.profileData,
      temperature: parsed.temperature,
      delayBetweenResultsMs: 0,
      onEvent: writeEvent,
    });

    logRequest({
      apiClient,
      startedAt,
      essayChars: totalEssayChars,
      success: true,
      errorCode: null,
    });
    res.end();
  } catch (err) {
    console.error('[publicApi] Batch grading failed:', err);
    writeEvent({
      type: 'error',
      error: { code: 'grading_failed', message: err.message || 'Internal grading error' },
    });
    logRequest({
      apiClient,
      startedAt,
      essayChars: totalEssayChars,
      success: false,
      errorCode: 'grading_failed',
    });
    res.end();
  }
}
