// Profile service
// Handles profile management operations for both database and file system

import { readFileSync, writeFileSync } from 'fs';
import { getDatabaseConfig } from '../config/database.js';

/**
 * Load profiles from database or file system for a specific user
 * @param {string} userId - User ID to filter profiles
 * @returns {Promise<Object>} Profiles object with profiles array
 */
async function loadProfiles(userId = null) {
  const { prisma, useDatabase } = getDatabaseConfig();

  if (useDatabase && prisma && userId) {
    console.log("[PROFILES] Loading from database for user:", userId);
    try {
      const profiles = await prisma.classProfile.findMany({
        where: { userId },
        orderBy: { lastModified: 'desc' }
      });
      return { profiles };
    } catch (error) {
      console.error("[PROFILES] Database error, falling back to file:", error.message);
    }
  }

  // Fallback to file system (local development)
  console.log("[PROFILES] Loading from file system");
  try {
    return JSON.parse(readFileSync('./class-profiles.json', 'utf8'));
  } catch (error) {
    // Fallback for serverless environments - load from environment variable
    if (process.env.CLASS_PROFILES) {
      return JSON.parse(process.env.CLASS_PROFILES);
    }
    // Default profiles for fresh deployments
    return {
      "profiles": [
        {
          "id": "business_b2_fall2024",
          "name": "Level 5 Midterm Exams - Fall 2025 Bimestre 1",
          "cefrLevel": "B2",
          "vocabulary": [
            "Bills", "Fee", "Expenses", "Income", "Installments", "Budget", "Penniless", "Frugal", "Stingy", "Prodigal", "Carelessly", "Unnecessarily", "In the red", "Bankrupt", "Broke", "Savings", "Leasing", "Sublet", "Mortgage", "Down payment", "Interest rate", "Insurance", "Walkability", "Neighborhood", "Security deposit", "Amenities", "Accessibility", "Pet-friendly", "Well-lit", "Decrease in price", "Increase in price", "Landlord", "Tenant", "Furnished", "Unfurnished", "Move-in date", "Eviction", "Property tax", "Renovated", "Fandom", "Nostalgia", "Binge Watch", "Doom Scroll", "Cult classic", "Aesthetic", "Pop culture reference", "Niche", "Mainstream", "Drop", "Hype", "Trope", "Archetype", "Chronically online", "Plot", "Character", "Development", "Cinematography", "Direction", "Dialogue", "Pacing", "Theme", "Originality", "Soundtrack", "Visual Effects", "Critique", "Production design", "Zeitgeist", "Business plan", "Market research", "Fundraising", "Funding", "Revenue", "Value propositions", "Pitch", "Networking", "Mentor", "Brand identity", "Customer", "Loyalty", "Startup", "Prefixes (any word using these counts as vocab used):", "un-", "re-", "in-/im-/il-/ir-", "dis-", "pre-", "mis-", "non-", "inter-", "sub-", "super-", "anti-", "Suffixes (any word using these counts as vocab used):", "-able, -ible", "-ive", "-ness", "-ment", "-tion, -sion", "-ity", "-ence", "-ship"
          ],
          "grammar": [
            "Tense and structure review", "Active vs. Passive verb forms (all tenses, modals)", "Identifying tenses in time clauses", "Pronouns and determiners review", "Personal pronouns", "Reflexive pronouns", "Indefinite pronouns", "Reciprocal pronouns", "Relative pronouns", "Articles", "Quantifiers", "Demonstratives", "Distributives", "Some / Any", "Too / Enough", "Review reported speech:", "Present (simple, continuous, perfect simple)", "Past (simple)", "Modals (can→could, will→would, may→might, should)", "Commands and instructions", "Review reporting verbs with verb patterns:", "Reporting verb + clause (agree, promise, suggest, complain, admit, explain, mention, claim)", "Reporting verb + direct object + clause (advise, warn, tell, convince, assure, persuade, notify, inform, remind)", "Reporting verb + infinitive (threaten, demand, offer, propose, refuse, ask, agree, claim, promise)", "Reporting verb + direct object + infinitive (invite, tell, beg, forbid, order, remind, advise, ask, encourage, warn [not to])", "Reporting verb + verb + ing (mention, deny, suggest, recommend, admit, propose)", "Reporting verb + preposition + verb + ing (agree [to], apologize [for], insist [on], argue [about])", "Reporting verb + direct object + preposition + verb + ing (blame [for], congratulate [on], discourage [from], criticize [for])", "Review conditional forms", "Real conditionals", "Unreal conditionals", "Mixed conditionals", "Alternatives to if in conditionals", "Conditionals without if (Inverted conditionals)", "Word building (prefixes and suffixes)"
          ],
          "created": "2024-09-04T00:00:00Z",
          "lastModified": "2025-09-07T01:39:20.278Z",
          "prompt": "Write a letter to a younger friend.\n\nWrite a letter to a younger friend who is interested in starting his/her own business. In this letter, share your insights on the importance of entrepreneurship and innovation. Highlight how innovative thinking can lead to successful ventures and provide practical advice on taking the first steps.\n\n \n\nFollow the specific pattern:\n\nParagraph 1: Introduce the topic of entrepreneurship and express your excitement about your friend's interest in starting a business.\nParagraph 2: Discuss the significance of innovation in entrepreneurship. Use reported speech to include a quote or advice from a successful entrepreneur you admire (e.g., Steve Jobs, Elon Musk, etc.)\nParagraph 3: Share practical steps your friend can take to start his/her entrepreneurial journey. Use conditional sentences to discuss potential scenarios\nParagraph 4: Summarize your main points and encourage your friend to embrace his/her entrepreneurial spirit.\nWrite your essay in 200 – 220 words. Don't forget to use linking words to make your text easier for the reader to understand. You can include the following sentence to your text:\n\nA mentor once advised me that taking calculated risks is essential for success because …\n\n \n\nIt is mandatory to use at least:\n\n6 grammar structures seen in class. Write the it between parentheses ().\n4 linkers. Write the linkers between *asterisks*.\n10 vocabulary items seen in class. Write the vocabulary items in CAPITAL LETTERS."
        },
        {
          "id": "academic_c1_fall2024",
          "name": "Level 6 Midterm Exams - Fall 2025",
          "cefrLevel": "C1",
          "vocabulary": [
            "furthermore", "nevertheless", "consequently", "substantial", "comprehensive", "predominantly", "simultaneously", "phenomenon", "implications", "methodology", "hypothesis", "correlation", "criterion", "paradigm", "empirical"
          ],
          "grammar": [
            "Complex conditional structures", "Subjunctive mood", "Inversion after negative adverbials", "Mixed conditionals", "Advanced passive constructions", "Participle clauses", "Cleft sentences", "Nominalization"
          ],
          "created": "2024-09-04T00:00:00Z",
          "lastModified": "2025-09-04T18:19:05.753Z"
        }
      ]
    };
  }
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
    writeFileSync('./class-profiles.json', JSON.stringify(profiles, null, 2));
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

    const newProfile = await prisma.classProfile.create({
      data: createData
    });
    return newProfile;
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

  if (useDatabase && prisma && userId) {
    console.log("[PROFILES] Updating profile in database for user:", userId);
    const updateFields = {
      name: updateData.name,
      cefrLevel: updateData.cefrLevel,
      vocabulary: updateData.vocabulary || [],
      grammar: updateData.grammar || [],
      prompt: updateData.prompt || '',
    };

    // Only add temperature if it exists in the request (avoid DB schema issues)
    if (updateData.temperature !== undefined) {
      updateFields.temperature = updateData.temperature || 0;
    }

    // First verify the profile exists and belongs to the user
    const existingProfile = await prisma.classProfile.findFirst({
      where: {
        id: profileId,
        userId
      }
    });

    if (!existingProfile) {
      throw new Error("Profile not found");
    }

    // Update using just the unique id
    const updatedProfile = await prisma.classProfile.update({
      where: {
        id: profileId
      },
      data: updateFields
    });
    return updatedProfile;
  } else {
    const profiles = await loadProfiles();
    const profileIndex = profiles.profiles.findIndex(p => p.id === profileId);

    if (profileIndex === -1) {
      throw new Error("Profile not found");
    }

    console.log('📝 UPDATING PROFILE:', profileId);
    console.log('📝 Request body:', updateData);
    console.log('📝 Profile found at index:', profileIndex);

    profiles.profiles[profileIndex] = {
      ...profiles.profiles[profileIndex],
      name: updateData.name,
      cefrLevel: updateData.cefrLevel,
      vocabulary: updateData.vocabulary || [],
      grammar: updateData.grammar || [],
      prompt: updateData.prompt || '',
      temperature: updateData.temperature || 0,
      lastModified: new Date().toISOString()
    };

    console.log('📝 Updated profile:', profiles.profiles[profileIndex]);

    await saveProfiles(profiles);
    console.log('📝 Profile saved successfully');
    return profiles.profiles[profileIndex];
  }
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