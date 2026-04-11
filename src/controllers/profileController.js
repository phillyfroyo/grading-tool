// Profile controller
// Route handlers for profile management endpoints

import {
  loadProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  findProfileById
} from '../services/profileService.js';
import { extractSyllabus } from '../../grader/syllabus-extractor.js';

/**
 * Get all profiles handler (GET /api/profiles)
 */
async function handleGetProfiles(req, res) {
  try {
    // Get userId from session or cookies
    let userId = req.session?.userId;
    if (!userId && req.signedCookies) {
      userId = req.signedCookies.userId;
    }

    const profiles = await loadProfiles(userId);
    res.json(profiles);
  } catch (error) {
    console.error('Error loading profiles:', error);
    res.status(500).json({ error: "Error loading profiles" });
  }
}

/**
 * Create new profile handler (POST /api/profiles)
 */
async function handleCreateProfile(req, res) {
  try {
    // Get userId from session or cookies
    let userId = req.session?.userId;
    if (!userId && req.signedCookies) {
      userId = req.signedCookies.userId;
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const newProfile = await createProfile(req.body, userId);
    res.json(newProfile);
  } catch (error) {
    console.error('Error creating profile:', error);
    res.status(500).json({ error: "Error creating profile" });
  }
}

/**
 * Update existing profile handler (PUT /api/profiles/:id)
 */
async function handleUpdateProfile(req, res) {
  try {
    // Get userId from session or cookies (same logic as auth middleware)
    let userId = req.session?.userId;
    if (!userId && req.signedCookies) {
      userId = req.signedCookies.userId;
    }

    console.log('[PROFILE_UPDATE] User ID:', userId, 'from session:', !!req.session?.userId, 'from cookies:', !!req.signedCookies?.userId);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const updatedProfile = await updateProfile(req.params.id, req.body, userId);
    res.json(updatedProfile);
  } catch (error) {
    if (error.message === 'Profile not found' || error.code === 'P2025') {
      return res.status(404).json({ error: "Profile not found" });
    }

    console.error('❌ ERROR UPDATING PROFILE:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    console.error('Profile ID:', req.params.id);
    res.status(500).json({ error: "Error updating profile", details: error.message });
  }
}

/**
 * Delete profile handler (DELETE /api/profiles/:id)
 */
async function handleDeleteProfile(req, res) {
  try {
    // Get userId from session or cookies
    let userId = req.session?.userId;
    if (!userId && req.signedCookies) {
      userId = req.signedCookies.userId;
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await deleteProfile(req.params.id, userId);
    res.json({ success: true });
  } catch (error) {
    if (error.message === 'Profile not found' || error.code === 'P2025') {
      return res.status(404).json({ error: "Profile not found" });
    }

    console.error('Error deleting profile:', error);
    res.status(500).json({ error: "Error deleting profile" });
  }
}

/**
 * Syllabus extraction handler (POST /api/profiles/extract-syllabus)
 *
 * Accepts pasted syllabus text and returns extracted vocabulary and grammar
 * arrays. Used by the class profile edit form so teachers can paste a syllabus
 * and auto-populate the vocab and grammar textareas instead of typing each
 * item manually.
 */
async function handleExtractSyllabus(req, res) {
  const { syllabusText } = req.body;

  if (!syllabusText || typeof syllabusText !== 'string' || !syllabusText.trim()) {
    return res.status(400).json({ error: 'syllabusText is required' });
  }

  // Cap input size to protect against runaway costs and token limits.
  // A 50KB cap comfortably fits a full multi-unit syllabus while preventing abuse.
  const MAX_LENGTH = 50000;
  if (syllabusText.length > MAX_LENGTH) {
    return res.status(400).json({
      error: `Syllabus text is too long (${syllabusText.length} chars). Maximum is ${MAX_LENGTH} chars.`
    });
  }

  try {
    console.log(`📋 Extracting syllabus (${syllabusText.length} chars)...`);
    const result = await extractSyllabus(syllabusText);
    console.log(`✅ Extracted ${result.vocabulary.length} vocab items, ${result.grammar.length} grammar items`);

    res.json({
      success: true,
      vocabulary: result.vocabulary,
      grammar: result.grammar,
    });
  } catch (error) {
    console.error('❌ Syllabus extraction failed:', error);
    res.status(500).json({
      error: 'Failed to extract syllabus',
      details: error.message,
    });
  }
}

export {
  handleGetProfiles,
  handleCreateProfile,
  handleUpdateProfile,
  handleDeleteProfile,
  handleExtractSyllabus
};