// Static routes
// Handles static file serving and main application routes

import express from 'express';
import path from 'path';
import { requireAuth, redirectIfAuthenticated } from '../middleware/authMiddleware.js';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => res.send("ok"));

// Login page (always accessible) - MUST BE BEFORE CATCH-ALL
router.get('/login', (req, res) => {
  // Prevent caching of HTML to ensure users always get latest version
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(process.cwd(), 'public', 'login.html'));
});

// Account page (require authentication)
router.get('/account', requireAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(process.cwd(), 'public', 'account.html'));
});

// Serve the main grading interface (require authentication)
router.get('/', requireAuth, (req, res) => {
  // Prevent caching of HTML to ensure users always get latest version
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

export default router;