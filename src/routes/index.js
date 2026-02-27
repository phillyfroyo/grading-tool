// Route aggregator
// Combines all route modules into a single router

import express from 'express';
import gradingRoutes from './grading.js';
import profileRoutes from './profiles.js';
import gradingSessionRoutes from './gradingSession.js';
import savedEssayRoutes from './savedEssays.js';
import staticRoutes from './static.js';
import authRoutes from './auth.js';

const router = express.Router();

// Mount route modules - ORDER MATTERS!
// Specific routes FIRST (auth, api)
router.use('/auth', authRoutes);
router.use('/', gradingRoutes);
router.use('/', profileRoutes);
router.use('/', gradingSessionRoutes);
router.use('/', savedEssayRoutes);

// Static routes LAST (includes catch-all / route)
router.use('/', staticRoutes);

export default router;