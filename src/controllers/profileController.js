// Profile controller
// Route handlers for profile management endpoints

import {
  loadProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  findProfileById
} from '../services/profileService.js';

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

export {
  handleGetProfiles,
  handleCreateProfile,
  handleUpdateProfile,
  handleDeleteProfile
};