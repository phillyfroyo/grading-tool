// Profile routes
// Handles all profile management endpoints

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  handleGetProfiles,
  handleCreateProfile,
  handleUpdateProfile,
  handleDeleteProfile
} from '../controllers/profileController.js';

const router = express.Router();

// Profile CRUD endpoints
router.get('/api/profiles', requireAuth, asyncHandler(handleGetProfiles));
router.post('/api/profiles', requireAuth, asyncHandler(handleCreateProfile));
router.put('/api/profiles/:id', requireAuth, asyncHandler(handleUpdateProfile));
router.delete('/api/profiles/:id', requireAuth, asyncHandler(handleDeleteProfile));

export default router;