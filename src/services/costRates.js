// src/services/costRates.js
//
// Pinned OpenAI model pricing, used to compute the USD cost of each grading
// event AT WRITE TIME. The in-app grading_events log is the SOLE source of
// truth for cost (we deliberately do not rely on OpenAI's dashboard), so the
// dollar cost is frozen into each row using these rates.
//
// Rates are USD per 1,000,000 tokens, split by input (prompt) vs output
// (completion). Verified against OpenAI API pricing on 2026-07-01:
//   gpt-4o        $2.50 / 1M input,  $10.00 / 1M output   (stable since Apr 2026)
//   gpt-4o-mini   $0.15 / 1M input,   $0.60 / 1M output
//
// If OpenAI changes these, update the table — historical rows keep the cost
// that was correct when they were written, which is what we want.
export const MODEL_RATES = {
  'gpt-4o': { inputPerM: 2.5, outputPerM: 10.0 },
  'gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.6 },
};

// Model the grader actually uses today. If a call reports an unknown model we
// fall back to this so cost is never silently zero for a real grade.
const DEFAULT_MODEL = 'gpt-4o';

/**
 * Compute the USD cost of a single grading call from its token usage.
 *
 * @param {string} model            - OpenAI model id (e.g. "gpt-4o").
 * @param {number} promptTokens     - Input tokens (summed across sub-calls).
 * @param {number} completionTokens - Output tokens (summed across sub-calls).
 * @returns {number} cost in USD (full precision — round only for display).
 */
export function computeCostUsd(model, promptTokens, completionTokens) {
  const rate = MODEL_RATES[model] || MODEL_RATES[DEFAULT_MODEL];
  const input = (Number(promptTokens) || 0) / 1_000_000 * rate.inputPerM;
  const output = (Number(completionTokens) || 0) / 1_000_000 * rate.outputPerM;
  return input + output;
}
