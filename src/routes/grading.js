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

// Apply authentication to all grading routes
router.use(requireAuth);

// Legacy grade endpoint (for backward compatibility)
router.post('/grade', asyncHandler(handleLegacyGrade));

// API grade endpoints
router.post('/api/grade', asyncHandler(handleApiGrade));
router.post('/api/grade-batch', asyncHandler(handleBatchGrade));

// Format endpoint
router.post('/format', asyncHandler(handleFormatEssay));

// Debug endpoints
router.get('/api/debug', asyncHandler(handleDebug));
router.post('/api/test-grade', asyncHandler(handleTestGrade));
router.post('/api/debug-form', asyncHandler(handleDebugForm));
router.post('/api/debug-grade', asyncHandler(handleDebugGrade));

export default router;
