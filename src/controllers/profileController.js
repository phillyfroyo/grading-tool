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
    const profiles = await loadProfiles();
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
    const newProfile = await createProfile(req.body);
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
    const updatedProfile = await updateProfile(req.params.id, req.body);
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
    await deleteProfile(req.params.id);
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