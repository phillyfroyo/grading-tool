// Static routes
// Handles static file serving and main application routes

import express from 'express';
import path from 'path';
import { requireAuth, redirectIfAuthenticated } from '../middleware/authMiddleware.js';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => res.send("ok"));

// Login page (redirect if already authenticated)
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'login.html'));
});

// Dashboard (require authentication)
router.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'dashboard.html'));
});

// Serve the main grading interface (require authentication)
// NOTE: This should be the LAST route to avoid intercepting other routes
router.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

export default router;