// Static routes
// Handles static file serving and main application routes

import express from 'express';
import path from 'path';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => res.send("ok"));

// Serve the main grading interface
router.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

export default router;