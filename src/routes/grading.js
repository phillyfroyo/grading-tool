// Grading routes
// Handles all grading-related endpoints

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  handleLegacyGrade,
  handleApiGrade,
  handleBatchGrade,
  handleBatchGradeStream,
  handleBatchGradeStreamInit,
  handleFormatEssay,
  handleDebug,
  handleTestGrade,
  handleDebugForm,
  handleDebugGrade
} from '../controllers/gradingController.js';

const router = express.Router();

// Legacy grade endpoint (for backward compatibility)
router.post('/grade', requireAuth, asyncHandler(handleLegacyGrade));

// API grade endpoints
router.post('/api/grade', requireAuth, asyncHandler(handleApiGrade));
router.post('/api/grade-batch', requireAuth, asyncHandler(handleBatchGrade));

// Format endpoint
router.post('/format', requireAuth, asyncHandler(handleFormatEssay));

// Debug endpoints
router.get('/api/debug', requireAuth, asyncHandler(handleDebug));
router.post('/api/test-grade', requireAuth, asyncHandler(handleTestGrade));
router.post('/api/debug-form', requireAuth, asyncHandler(handleDebugForm));
router.post('/api/debug-grade', requireAuth, asyncHandler(handleDebugGrade));

export default router;
