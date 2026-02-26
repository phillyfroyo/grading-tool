// Grading Session Controller
// Route handlers for grading session save/load/delete

import {
  saveGradingSession,
  loadGradingSession,
  deleteGradingSession,
} from '../services/gradingSessionService.js';

/**
 * Helper to extract userId from request
 */
function getUserId(req) {
  return req.session?.userId || req.signedCookies?.userId || null;
}

/**
 * POST /api/grading-session — save session
 */
async function handleSaveGradingSession(req, res) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const { activeTab, sessionData } = req.body;
  if (!activeTab || !sessionData) {
    return res.status(400).json({ error: 'activeTab and sessionData are required' });
  }

  const rhKeys = sessionData?.renderedHTML ? Object.keys(sessionData.renderedHTML) : [];
  console.log('[GRADING_SESSION] Save - activeTab:', activeTab,
    'renderedHTML keys:', rhKeys,
    'renderedHTML lengths:', rhKeys.map(k => (sessionData.renderedHTML[k] || '').length));

  const saved = await saveGradingSession(userId, activeTab, sessionData);
  if (!saved) {
    return res.status(500).json({ error: 'Failed to save grading session' });
  }

  res.json({ success: true });
}

/**
 * GET /api/grading-session — load session
 */
async function handleLoadGradingSession(req, res) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const session = await loadGradingSession(userId);
  if (!session) {
    return res.json({ exists: false });
  }

  res.json({ exists: true, activeTab: session.activeTab, sessionData: session.sessionData });
}

/**
 * DELETE /api/grading-session — delete session
 */
async function handleDeleteGradingSession(req, res) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  await deleteGradingSession(userId);
  res.json({ success: true });
}

export {
  handleSaveGradingSession,
  handleLoadGradingSession,
  handleDeleteGradingSession,
};
