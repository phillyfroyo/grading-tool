// Profile routes
// Handles all profile management endpoints

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  handleGetProfiles,
  handleCreateProfile,
  handleUpdateProfile,
  handleDeleteProfile
} from '../controllers/profileController.js';

const router = express.Router();

// Profile CRUD endpoints
router.get('/api/profiles', asyncHandler(handleGetProfiles));
router.post('/api/profiles', asyncHandler(handleCreateProfile));
router.put('/api/profiles/:id', asyncHandler(handleUpdateProfile));
router.delete('/api/profiles/:id', asyncHandler(handleDeleteProfile));

export default router;