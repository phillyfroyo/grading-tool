// Saved Essays routes
// Handles CRUD operations for saved essays

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  handleSaveEssay,
  handleUpdateEssay,
  handleGetEssays,
  handleGetEssay,
  handleDeleteEssay,
} from '../controllers/savedEssayController.js';

const router = express.Router();

router.get('/api/saved-essays', requireAuth, asyncHandler(handleGetEssays));
router.get('/api/saved-essays/:id', requireAuth, asyncHandler(handleGetEssay));
router.post('/api/saved-essays', requireAuth, asyncHandler(handleSaveEssay));
router.put('/api/saved-essays/:id', requireAuth, asyncHandler(handleUpdateEssay));
router.delete('/api/saved-essays/:id', requireAuth, asyncHandler(handleDeleteEssay));

export default router;
