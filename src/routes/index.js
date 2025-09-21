// Route aggregator
// Combines all route modules into a single router

import express from 'express';
import gradingRoutes from './grading.js';
import profileRoutes from './profiles.js';
import staticRoutes from './static.js';

const router = express.Router();

// Mount route modules
router.use('/', staticRoutes);
router.use('/', gradingRoutes);
router.use('/', profileRoutes);

export default router;