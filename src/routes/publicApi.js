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
import { handleGrade } from '../controllers/publicApiController.js';

const router = express.Router();

router.post('/grade', apiKeyAuth, asyncHandler(handleGrade));

export default router;
