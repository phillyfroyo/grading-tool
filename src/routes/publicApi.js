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

router.post('/grade', apiKeyAuth, gradeRateLimiter, asyncHandler(handleGrade));
router.post('/grade-batch', apiKeyAuth, gradeRateLimiter, asyncHandler(handleBatchGrade));

// Scoped error handler: catch JSON body-parse errors thrown by express.json()
// before the route runs, and return them in the documented {error:{code,message}}
// envelope with HTTP 400 — not the generic 500 from the global errorHandler.
router.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({
      error: { code: 'invalid_request', message: 'Request body is not valid JSON' },
    });
  }
  next(err);
});

export default router;
