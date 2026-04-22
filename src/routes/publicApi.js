/**
 * Public API routes (v1).
 *
 * Stateless, API-key-authenticated endpoints intended for external platforms
 * to call. Separate from the session-based /api/* routes used by the
 * grading-tool web UI.
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { gradeRateLimiter } from '../middleware/rateLimiter.js';
import { handleGrade, handleBatchGrade } from '../controllers/publicApiController.js';

const router = express.Router();

// Health check — no auth, no rate limit. Uptime monitors ping this.
// Keep it cheap: no DB lookup, no LLM call, no dependency check.
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

router.post('/grade', apiKeyAuth, gradeRateLimiter, asyncHandler(handleGrade));
router.post('/grade-batch', apiKeyAuth, gradeRateLimiter, asyncHandler(handleBatchGrade));

export default router;
