/**
 * Shared batch grading service.
 *
 * Grades a list of essays in parallel batches of 2, reporting per-essay
 * results as they complete. Used by both the session-authed web UI handler
 * and the API-key-authed /v1/grade-batch endpoint — they differ only in how
 * events are delivered to the caller, so this function emits them via an
 * `onEvent` callback that each handler wires to its own response stream.
 *
 * Why 2 at a time: the 3-step grading pipeline (error detection → metrics →
 * grading) fires 3 OpenAI calls per essay. With OpenAI's 30k TPM limit,
 * parallelism of 2 keeps us safely under while still cutting wall-clock
 * time roughly in half versus serial grading.
 */

import { gradeEssaySimple } from '../../grader/grader-simple.js';
import { applyTemperatureAdjustment } from './temperatureService.js';

const BATCH_SIZE = 2;

/**
 * @param {object} opts
 * @param {Array} opts.essays — each: { studentText, studentName?, studentNickname?, id? }
 * @param {string} opts.prompt
 * @param {object} opts.profileData — class profile (from DB for UI, inline rubric for API)
 * @param {number} [opts.temperature=0]
 * @param {number} [opts.delayBetweenResultsMs=0] — pacing for visual UX; 0 for API callers
 * @param {(event: object) => void} opts.onEvent — called with {type, ...payload} events
 */
export async function processBatchStreaming({
  essays,
  prompt,
  profileData,
  temperature = 0,
  delayBetweenResultsMs = 0,
  onEvent,
}) {
  const startTime = Date.now();
  const totalBatches = Math.ceil(essays.length / BATCH_SIZE);

  onEvent({
    type: 'start',
    totalEssays: essays.length,
    totalBatches,
    message: 'Starting parallel batch grading...',
  });

  let currentBatch = 1;

  for (let batchStart = 0; batchStart < essays.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, essays.length);
    const batch = essays.slice(batchStart, batchEnd);

    batch.forEach((essay, batchIndex) => {
      const globalIndex = batchStart + batchIndex;
      onEvent({
        type: 'processing',
        index: globalIndex,
        id: essay.id,
        studentName: essay.studentName,
        batch: currentBatch,
        totalBatches,
        message: `Processing ${essay.studentName || essay.id || `essay ${globalIndex + 1}`} (batch ${currentBatch}/${totalBatches})...`,
      });
    });

    const batchPromises = batch.map(async (essay, batchIndex) => {
      const globalIndex = batchStart + batchIndex;
      try {
        const result = await gradeEssaySimple(
          essay.studentText,
          profileData,
          null,
          essay.studentNickname,
        );

        if (!result || !result.scores || !result.total) {
          throw new Error('Incomplete grading result — missing scores or total');
        }

        const finalResult = applyTemperatureAdjustment(result, temperature);
        finalResult.studentName = essay.studentName;
        finalResult.studentNickname = essay.studentNickname;
        finalResult.overallScore = finalResult.total?.points ?? 0;

        return {
          index: globalIndex,
          id: essay.id,
          success: true,
          studentName: essay.studentName,
          studentNickname: essay.studentNickname,
          result: finalResult,
        };
      } catch (error) {
        console.error(`[batchGrading] Essay ${globalIndex + 1} failed:`, error.message);
        return {
          index: globalIndex,
          id: essay.id,
          success: false,
          studentName: essay.studentName,
          studentNickname: essay.studentNickname,
          error: error.message,
        };
      }
    });

    const settled = await Promise.allSettled(batchPromises);
    const processedResults = settled.map((r, idx) => {
      if (r.status === 'fulfilled') return r.value;
      const globalIndex = batchStart + idx;
      const essay = batch[idx];
      console.error(`[batchGrading] Promise rejected for essay ${globalIndex + 1}:`, r.reason);
      return {
        index: globalIndex,
        id: essay?.id,
        success: false,
        studentName: essay?.studentName || `Student ${globalIndex + 1}`,
        studentNickname: essay?.studentNickname || '',
        error: r.reason?.message || 'Unknown error — essay grading failed',
      };
    });

    for (let i = 0; i < processedResults.length; i++) {
      if (i > 0 && delayBetweenResultsMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenResultsMs));
      }
      onEvent({ type: 'result', ...processedResults[i] });
    }

    currentBatch++;
  }

  const totalTimeSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  onEvent({
    type: 'complete',
    totalEssays: essays.length,
    totalBatches,
    totalTimeSeconds,
    message: `All ${essays.length} essays processed in ${totalBatches} batches`,
  });
}
