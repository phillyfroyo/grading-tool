// Grading Session Service
// Handles save, load, and delete of grading sessions in the database

/**
 * Get Prisma client with runtime check
 */
async function getPrismaClient() {
  try {
    const { prisma } = await import('../../lib/prisma.js');
    return prisma;
  } catch (error) {
    console.error('[GRADING_SESSION] Failed to import Prisma client:', error.message);
    return null;
  }
}

/**
 * Save (upsert) a grading session for a user
 * @param {string} userId - User ID
 * @param {string} activeTab - Currently active tab name
 * @param {Object} sessionData - Session data object to persist
 * @returns {Promise<Object|null>} Saved session or null on failure
 */
async function saveGradingSession(userId, activeTab, sessionData) {
  const prisma = await getPrismaClient();
  if (!prisma || !userId) return null;

  try {
    const dataString = typeof sessionData === 'string'
      ? sessionData
      : JSON.stringify(sessionData);

    const session = await prisma.saved_grading_sessions.upsert({
      where: { userId },
      update: {
        activeTab,
        sessionData: dataString,
      },
      create: {
        userId,
        activeTab,
        sessionData: dataString,
      },
    });

    return session;
  } catch (error) {
    console.error('[GRADING_SESSION] Save error:', error.message);
    return null;
  }
}

/**
 * Load a grading session for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Session with parsed sessionData, or null
 */
async function loadGradingSession(userId) {
  const prisma = await getPrismaClient();
  if (!prisma || !userId) return null;

  try {
    const session = await prisma.saved_grading_sessions.findUnique({
      where: { userId },
    });

    if (!session) return null;

    return {
      ...session,
      sessionData: JSON.parse(session.sessionData),
    };
  } catch (error) {
    console.error('[GRADING_SESSION] Load error:', error.message);
    return null;
  }
}

/**
 * Delete a grading session for a user
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if deleted, false otherwise
 */
async function deleteGradingSession(userId) {
  const prisma = await getPrismaClient();
  if (!prisma || !userId) return false;

  try {
    await prisma.saved_grading_sessions.delete({
      where: { userId },
    });
    return true;
  } catch (error) {
    // P2025 = record not found — not an error
    if (error.code === 'P2025') return true;
    console.error('[GRADING_SESSION] Delete error:', error.message);
    return false;
  }
}

export { saveGradingSession, loadGradingSession, deleteGradingSession };
