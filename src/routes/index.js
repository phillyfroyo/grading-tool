// Route aggregator
// Combines all route modules into a single router

import express from 'express';
import gradingRoutes from './grading.js';
import profileRoutes from './profiles.js';
import staticRoutes from './static.js';
import authRoutes from './auth.js';

const router = express.Router();

// Mount route modules - ORDER MATTERS!
// Specific routes FIRST (auth, api)
router.use('/auth', authRoutes);
router.use('/', gradingRoutes);
router.use('/', profileRoutes);

// Static routes LAST (includes catch-all / route)
router.use('/', staticRoutes);

export default router;