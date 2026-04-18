/**
 * Rate limiting for the public /v1/* API.
 *
 * Keyed on req.apiClient (set by apiKeyAuth) rather than IP, so that two
 * different tenants behind the same egress IP get independent budgets. Mount
 * AFTER apiKeyAuth so req.apiClient is populated.
 *
 * Default: 60 requests/minute per API client. Protects against buggy caller
 * loops that would otherwise rack up LLM costs.
 */

import rateLimit from 'express-rate-limit';

export const gradeRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.apiClient || 'unknown',
  handler: (req, res) => {
    console.log('[publicApi]', JSON.stringify({
      ts: new Date().toISOString(),
      apiClient: req.apiClient || 'unknown',
      event: 'rate_limited',
    }));
    res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Too many requests. Retry after the window resets.',
      },
    });
  },
});
