// src/routes/admin.js
//
// Admin dashboard routes — all gated by a shared ADMIN_SECRET (see
// middleware/adminAuth.js), independent of normal user login. When the secret
// is unconfigured, the entire surface 404s.

import express from 'express';
import path from 'path';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  requireAdmin,
  handleAdminLogin,
  handleAdminLogout,
  adminConfigured,
  isAdminAuthed,
} from '../middleware/adminAuth.js';
import {
  handleAdminSummary,
  handleAdminUsers,
  handleAdminUserDetail,
} from '../controllers/adminController.js';

const router = express.Router();

const noCache = (res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
};

// Auth endpoints (no requireAdmin — they establish/clear the session).
router.post('/admin/login', handleAdminLogin);
router.post('/admin/logout', handleAdminLogout);

// Data API (gated).
router.get('/admin/api/summary', requireAdmin, asyncHandler(handleAdminSummary));
router.get('/admin/api/users', requireAdmin, asyncHandler(handleAdminUsers));
router.get('/admin/api/users/:id', requireAdmin, asyncHandler(handleAdminUserDetail));

// Dashboard page. Serves admin.html for both the login form and the dashboard;
// the page's JS calls /admin/api/summary and shows the login form on 401.
// 404 when the feature is unconfigured so it's invisible on misconfigured deploys.
//
// The HTML lives in src/views/, NOT public/, on purpose: files under public/ are
// served directly by express.static (mounted before this router in server.js),
// which would let GET /admin.html reach the dashboard shell and bypass this
// adminConfigured() gate. Serving it via sendFile from a non-static dir keeps
// the whole admin surface behind the guard.
router.get('/admin', (req, res) => {
  if (!adminConfigured()) return res.status(404).send('Not found');
  noCache(res);
  res.sendFile(path.join(process.cwd(), 'src', 'views', 'admin.html'));
});

// Lightweight auth-status probe the page uses to decide login-form vs dashboard.
router.get('/admin/api/whoami', (req, res) => {
  if (!adminConfigured()) return res.status(404).json({ success: false });
  res.json({ success: true, authed: isAdminAuthed(req) });
});

export default router;
