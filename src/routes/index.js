// Route aggregator
// Combines all route modules into a single router

import express from 'express';
import gradingRoutes from './grading.js';
import profileRoutes from './profiles.js';
import staticRoutes from './static.js';
import authRoutes from './auth.js';

const router = express.Router();

// Mount route modules - ORDER MATTERS!
// Auth routes first (they don't conflict with other routes)
router.use('/auth', authRoutes);

// API routes before catch-all static routes
router.use('/', gradingRoutes);
router.use('/', profileRoutes);

// Static routes last (they have catch-all patterns)
router.use('/', staticRoutes);

export default router;