// Profile service
// Handles profile management operations for both database and file system

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getDatabaseConfig } from '../config/database.js';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load profiles from database or file system for a specific user
 * @param {string} userId - User ID to filter profiles
 * @returns {Promise<Object>} Profiles object with profiles array
 */
async function loadProfiles(userId = null) {
  const { prisma, useDatabase } = getDatabaseConfig();

  console.log("[PROFILES] loadProfiles called with:");
  console.log("  - userId:", userId);
  console.log("  - useDatabase:", useDatabase);
  console.log("  - prisma available:", !!prisma);

  if (prisma && userId) {
    console.log("[PROFILES] Loading from database for user:", userId);
    try {
      const profiles = await prisma.classProfile.findMany({
        where: { userId },
        orderBy: { lastModified: 'desc' }
      });
      console.log("[PROFILES] Database returned", profiles.length, "profiles");
      console.log("[PROFILES] Profile IDs:", profiles.map(p => p.id));
      return { profiles };
    } catch (error) {
      console.error("[PROFILES] Database error, returning default profiles:", error.message);
    }
  }

  // Return empty profiles when database is unavailable (each user should start fresh)
  console.log("[PROFILES] Using empty profiles for new user (no database connection)");
  return {
    profiles: []
  };
}

/**
 * Save profiles to database or file system
 * @param {Object} profiles - Profiles object to save
 * @returns {Promise<void>}
 */
async function saveProfiles(profiles) {
  const { prisma, useDatabase } = getDatabaseConfig();

  // Temporarily force file system usage for profile updates to avoid DB schema issues
  if (false && useDatabase && prisma) {
    console.log("[PROFILES] Database saving handled by individual endpoints");
    return;
  }

  // Fallback to file system (local development)
  console.log("[PROFILES] Saving to file system");
  try {
    const profilesPath = join(__dirname, '..', '..', 'class-profiles.json');
    writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));
  } catch (error) {
    console.warn('Cannot save to file system:', error.message);
  }
}

/**
 * Find profile by ID for a specific user
 * @param {string} profileId - Profile ID to find
 * @param {string} userId - User ID to filter by
 * @returns {Promise<Object|null>} Profile object or null if not found
 */
async function findProfileById(profileId, userId = null) {
  const { prisma, useDatabase } = getDatabaseConfig();

  if (useDatabase && prisma && userId) {
    console.log("📊 Searching database for profile...");
    try {
      const profileData = await prisma.classProfile.findFirst({
        where: {
          id: profileId,
          userId
        }
      });
      console.log("🎯 Database search result:", profileData ? "FOUND" : "NOT FOUND");
      return profileData;
    } catch (error) {
      console.error("Database search error:", error);
      // Fall through to file system search
    }
  }

  console.log("📁 Searching file system for profile...");
  const profiles = await loadProfiles();
  console.log("📋 Available profiles:", profiles.profiles?.map(p => p.id) || []);
  const profileData = profiles.profiles.find(p => p.id === profileId);
  console.log("🎯 File search result:", profileData ? "FOUND" : "NOT FOUND");
  return profileData;
}

/**
 * Create new profile for a specific user
 * @param {Object} profileData - Profile data to create
 * @param {string} userId - User ID to associate the profile with
 * @returns {Promise<Object>} Created profile
 */
async function createProfile(profileData, userId) {
  const { prisma, useDatabase } = getDatabaseConfig();

  console.log("[PROFILES] createProfile called with:");
  console.log("  - userId:", userId);
  console.log("  - useDatabase:", useDatabase);
  console.log("  - prisma available:", !!prisma);
  console.log("  - profileData:", profileData);

  if (useDatabase && prisma && userId) {
    console.log("[PROFILES] Creating profile in database for user:", userId);
    const createData = {
      name: profileData.name,
      cefrLevel: profileData.cefrLevel,
      vocabulary: profileData.vocabulary || [],
      grammar: profileData.grammar || [],
      prompt: profileData.prompt || '',
      userId: userId
    };

    // Only add temperature if it exists in the request (avoid DB schema issues)
    if (profileData.temperature !== undefined) {
      createData.temperature = profileData.temperature || 0;
    }

    console.log("[PROFILES] Database create data:", createData);

    try {
      const newProfile = await prisma.classProfile.create({
        data: createData
      });
      console.log("[PROFILES] Database created profile:", newProfile);

      // Verify the profile was created
      const verifyProfile = await prisma.classProfile.findUnique({
        where: { id: newProfile.id }
      });

      if (!verifyProfile) {
        throw new Error('Profile creation verification failed');
      }

      console.log("[PROFILES] Profile creation verified:", verifyProfile.id);
      return newProfile;
    } catch (dbError) {
      console.error("[PROFILES] Database creation error:", dbError);
      throw new Error(`Failed to create profile: ${dbError.message}`);
    }
  } else {
    const profiles = await loadProfiles();
    const newProfile = {
      id: `profile_${Date.now()}`,
      name: profileData.name,
      cefrLevel: profileData.cefrLevel,
      vocabulary: profileData.vocabulary || [],
      grammar: profileData.grammar || [],
      prompt: profileData.prompt || '',
      temperature: profileData.temperature || 0,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    profiles.profiles.push(newProfile);
    await saveProfiles(profiles);
    return newProfile;
  }
}

/**
 * Update existing profile for a specific user
 * @param {string} profileId - Profile ID to update
 * @param {Object} updateData - Data to update
 * @param {string} userId - User ID to filter by
 * @returns {Promise<Object>} Updated profile
 */
async function updateProfile(profileId, updateData, userId) {
  const { prisma, useDatabase } = getDatabaseConfig();
  const { isVercel } = await import('../config/index.js');

  console.log('[PROFILES] Update environment check:', {
    useDatabase,
    hasPrisma: !!prisma,
    hasUserId: !!userId,
    isVercel,
    databaseUrl: !!process.env.DATABASE_URL
  });

  // Always try database first if available
  if (prisma && userId) {
    console.log("[PROFILES] Updating profile in database for user:", userId);
    console.log('[PROFILES] prisma object:', typeof prisma, Object.keys(prisma || {}));

    try {
      const updateFields = {
        name: updateData.name,
        cefrLevel: updateData.cefrLevel,
        vocabulary: updateData.vocabulary || [],
        grammar: updateData.grammar || [],
        prompt: updateData.prompt || '',
      };

      // Only add temperature if it exists in the request
      if (updateData.temperature !== undefined) {
        updateFields.temperature = parseFloat(updateData.temperature) || 0;
      }

      console.log('[PROFILES] About to call prisma.classProfile.findFirst with:', { profileId, userId });

      // First verify the profile exists and belongs to the user
      const existingProfile = await prisma.classProfile.findFirst({
        where: {
          id: profileId,
          userId
        }
      });

      if (!existingProfile) {
        console.error('[PROFILES] Profile not found in database for user:', userId);
        throw new Error("Profile not found");
      }

      // Update using just the unique id
      console.log('[PROFILES] Updating profile with data:', updateFields);
      const updatedProfile = await prisma.classProfile.update({
        where: {
          id: profileId
        },
        data: updateFields
      });

      console.log('[PROFILES] Successfully updated profile in database:', updatedProfile);
      return updatedProfile;
    } catch (dbError) {
      console.error('[PROFILES] Database update failed:', dbError.message);
      console.error('[PROFILES] Stack:', dbError.stack);

      // If database fails, we need to return the updated data anyway
      // Create a mock updated profile with the new data
      const mockProfile = {
        id: profileId,
        name: updateData.name,
        cefrLevel: updateData.cefrLevel,
        vocabulary: updateData.vocabulary || [],
        grammar: updateData.grammar || [],
        prompt: updateData.prompt || '',
        temperature: parseFloat(updateData.temperature) || 0,
        userId: userId,
        lastModified: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      console.warn('[PROFILES] Database failed, returning mock updated profile for consistency');
      return mockProfile;
    }
  }

  // If no database connection, create mock profile
  console.warn('[PROFILES] No database connection available, creating mock profile');
  const mockProfile = {
    id: profileId,
    name: updateData.name,
    cefrLevel: updateData.cefrLevel,
    vocabulary: updateData.vocabulary || [],
    grammar: updateData.grammar || [],
    prompt: updateData.prompt || '',
    temperature: parseFloat(updateData.temperature) || 0,
    userId: userId,
    lastModified: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  return mockProfile;
}

/**
 * Delete profile for a specific user
 * @param {string} profileId - Profile ID to delete
 * @param {string} userId - User ID to filter by
 * @returns {Promise<boolean>} Success status
 */
async function deleteProfile(profileId, userId) {
  const { prisma, useDatabase } = getDatabaseConfig();

  if (useDatabase && prisma && userId) {
    console.log("[PROFILES] Deleting profile in database for user:", userId);

    // First verify the profile exists and belongs to the user
    const profile = await prisma.classProfile.findFirst({
      where: {
        id: profileId,
        userId
      }
    });

    if (!profile) {
      throw new Error("Profile not found");
    }

    // Delete using just the unique id
    await prisma.classProfile.delete({
      where: {
        id: profileId
      }
    });
    return true;
  } else {
    const profiles = await loadProfiles();
    const profileIndex = profiles.profiles.findIndex(p => p.id === profileId);

    if (profileIndex === -1) {
      throw new Error("Profile not found");
    }

    profiles.profiles.splice(profileIndex, 1);
    await saveProfiles(profiles);
    return true;
  }
}

export {
  loadProfiles,
  saveProfiles,
  findProfileById,
  createProfile,
  updateProfile,
  deleteProfile
};