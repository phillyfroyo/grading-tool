// Saved Essay Service
// Handles CRUD operations for saved essays in the database

/**
 * Get Prisma client with runtime check
 */
async function getPrismaClient() {
  try {
    const { prisma } = await import('../../lib/prisma.js');
    return prisma;
  } catch (error) {
    console.error('[SAVED_ESSAY] Failed to import Prisma client:', error.message);
    return null;
  }
}

/**
 * Save a new essay
 * @param {string} userId - User ID
 * @param {Object} data - Essay data
 * @param {string} data.classProfileId - Optional class profile ID
 * @param {string} data.studentName - Student name
 * @param {string} data.renderedHTML - Rendered HTML of the essay
 * @param {string|Object} data.essayData - Essay grading data (JSON)
 * @returns {Promise<Object|null>} Created essay or null on failure
 */
async function saveEssay(userId, { classProfileId, studentName, renderedHTML, essayData }) {
  const prisma = await getPrismaClient();
  if (!prisma || !userId) return null;

  try {
    const dataString = typeof essayData === 'string'
      ? essayData
      : JSON.stringify(essayData);

    const essay = await prisma.saved_essays.create({
      data: {
        userId,
        classProfileId: classProfileId || null,
        studentName,
        renderedHTML,
        essayData: dataString,
      },
    });

    return essay;
  } catch (error) {
    console.error('[SAVED_ESSAY] Save error:', error.message);
    return null;
  }
}

/**
 * Update an existing essay (verify ownership via userId)
 * @param {string} id - Essay ID
 * @param {string} userId - User ID (for ownership check)
 * @param {Object} data - Fields to update
 * @param {string} [data.renderedHTML] - Updated rendered HTML
 * @param {string|Object} [data.essayData] - Updated essay data
 * @returns {Promise<Object|null>} Updated essay or null on failure
 */
async function updateEssay(id, userId, { renderedHTML, essayData }) {
  const prisma = await getPrismaClient();
  if (!prisma || !userId || !id) return null;

  try {
    // Verify ownership
    const existing = await prisma.saved_essays.findFirst({
      where: { id, userId },
    });
    if (!existing) return null;

    const updateData = {};
    if (renderedHTML !== undefined) updateData.renderedHTML = renderedHTML;
    if (essayData !== undefined) {
      updateData.essayData = typeof essayData === 'string'
        ? essayData
        : JSON.stringify(essayData);
    }

    const essay = await prisma.saved_essays.update({
      where: { id },
      data: updateData,
    });

    return essay;
  } catch (error) {
    console.error('[SAVED_ESSAY] Update error:', error.message);
    return null;
  }
}

/**
 * Get all essays for a user, ordered by createdAt desc
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of essays
 */
async function getEssaysByUser(userId) {
  const prisma = await getPrismaClient();
  if (!prisma || !userId) return [];

  try {
    const essays = await prisma.saved_essays.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return essays;
  } catch (error) {
    console.error('[SAVED_ESSAY] GetAll error:', error.message);
    return [];
  }
}

/**
 * Get a single essay by ID (with ownership check)
 * @param {string} id - Essay ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Essay or null
 */
async function getEssayById(id, userId) {
  const prisma = await getPrismaClient();
  if (!prisma || !userId || !id) return null;

  try {
    const essay = await prisma.saved_essays.findFirst({
      where: { id, userId },
    });

    return essay;
  } catch (error) {
    console.error('[SAVED_ESSAY] GetById error:', error.message);
    return null;
  }
}

/**
 * Delete an essay (with ownership check)
 * @param {string} id - Essay ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteEssay(id, userId) {
  const prisma = await getPrismaClient();
  if (!prisma || !userId || !id) return false;

  try {
    // Verify ownership before deleting
    const existing = await prisma.saved_essays.findFirst({
      where: { id, userId },
    });
    if (!existing) return false;

    await prisma.saved_essays.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    if (error.code === 'P2025') return true;
    console.error('[SAVED_ESSAY] Delete error:', error.message);
    return false;
  }
}

export { saveEssay, updateEssay, getEssaysByUser, getEssayById, deleteEssay };
