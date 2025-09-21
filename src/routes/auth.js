/**
 * Authentication routes
 */

import express from 'express';
import AuthController from '../controllers/authController.js';
import { redirectIfAuthenticated } from '../middleware/authMiddleware.js';

const router = express.Router();
const authController = new AuthController();

console.log('[AUTH_ROUTES] Auth routes being registered');

// POST /auth/login - Login or register with email
router.post('/login', (req, res, next) => {
  console.log('[AUTH_ROUTES] Login route hit:', req.method, req.path, req.body);
  try {
    return authController.login(req, res);
  } catch (error) {
    console.error('[AUTH_ROUTES] Route error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Test route to verify auth routes are working
router.get('/test', (req, res) => {
  console.log('[AUTH_ROUTES] Test route hit');
  res.json({ success: true, message: 'Auth routes working', timestamp: new Date().toISOString() });
});

// POST /auth/logout - Logout user
router.post('/logout', authController.logout.bind(authController));

// GET /auth/status - Check authentication status
router.get('/status', authController.status.bind(authController));

export default router;