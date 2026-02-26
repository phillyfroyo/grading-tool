// Grading Session routes
// Handles save, load, and delete of grading sessions

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  handleSaveGradingSession,
  handleLoadGradingSession,
  handleDeleteGradingSession,
} from '../controllers/gradingSessionController.js';

const router = express.Router();

router.get('/api/grading-session', requireAuth, asyncHandler(handleLoadGradingSession));
router.post('/api/grading-session', requireAuth, asyncHandler(handleSaveGradingSession));
router.delete('/api/grading-session', requireAuth, asyncHandler(handleDeleteGradingSession));

export default router;
