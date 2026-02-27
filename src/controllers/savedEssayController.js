// Saved Essay Controller
// Route handlers for saved essay CRUD operations

import {
  saveEssay,
  updateEssay,
  getEssaysByUser,
  getEssayById,
  deleteEssay,
} from '../services/savedEssayService.js';

/**
 * Helper to extract userId from request
 */
function getUserId(req) {
  return req.session?.userId || req.signedCookies?.userId || null;
}

/**
 * POST /api/saved-essays — create a saved essay
 */
async function handleSaveEssay(req, res) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const { classProfileId, studentName, renderedHTML, essayData } = req.body;
  if (!studentName || !renderedHTML || !essayData) {
    return res.status(400).json({ error: 'studentName, renderedHTML, and essayData are required' });
  }

  const saved = await saveEssay(userId, { classProfileId, studentName, renderedHTML, essayData });
  if (!saved) {
    return res.status(500).json({ error: 'Failed to save essay' });
  }

  res.json({ success: true, id: saved.id });
}

/**
 * PUT /api/saved-essays/:id — update a saved essay
 */
async function handleUpdateEssay(req, res) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const { id } = req.params;
  const { renderedHTML, essayData } = req.body;

  if (!renderedHTML && !essayData) {
    return res.status(400).json({ error: 'At least one of renderedHTML or essayData is required' });
  }

  const updated = await updateEssay(id, userId, { renderedHTML, essayData });
  if (!updated) {
    return res.status(404).json({ error: 'Essay not found or access denied' });
  }

  res.json({ success: true });
}

/**
 * GET /api/saved-essays — list all essays for user
 */
async function handleGetEssays(req, res) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const essays = await getEssaysByUser(userId);
  res.json({ essays });
}

/**
 * GET /api/saved-essays/:id — get a single essay
 */
async function handleGetEssay(req, res) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const { id } = req.params;
  const essay = await getEssayById(id, userId);
  if (!essay) {
    return res.status(404).json({ error: 'Essay not found' });
  }

  res.json({ essay });
}

/**
 * DELETE /api/saved-essays/:id — delete a saved essay
 */
async function handleDeleteEssay(req, res) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const { id } = req.params;
  const deleted = await deleteEssay(id, userId);
  if (!deleted) {
    return res.status(404).json({ error: 'Essay not found or access denied' });
  }

  res.json({ success: true });
}

export {
  handleSaveEssay,
  handleUpdateEssay,
  handleGetEssays,
  handleGetEssay,
  handleDeleteEssay,
};
