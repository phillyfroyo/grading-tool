// Grading service
// Contains the unified grading logic for both local and Vercel environments

import { gradeEssay } from "../../grader/grader-simple.js";

/**
 * Unified grading function that works identically in local and Vercel environments
 * @param {string} studentText - The student's essay text
 * @param {string} prompt - The assignment prompt
 * @param {Object} profileData - The class profile data
 * @param {string} studentNickname - Optional student nickname for personalized feedback
 * @returns {Promise<Object>} Grading results
 */
async function gradeEssayUnified(studentText, prompt, profileData, studentNickname) {
  console.log('=== STARTING SIMPLIFIED 3-STEP GRADING ===');
  console.log('Profile:', profileData.name);
  console.log('Student text length:', studentText?.length);

  try {
    // Use the simplified 3-step grader (mimics ChatGPT's natural performance)
    console.log('🚀 Using simplified 3-step grader: Error Detection → Metrics → Grading...');
    console.log('🏷️ Student nickname:', studentNickname || 'none provided');
    const result = await gradeEssay(studentText, prompt, profileData.id, studentNickname);
    console.log('✅ Simplified grading completed successfully!');
    return result;
  } catch (error) {
    console.error('❌ Error in simplified grading:', error);
    throw error;
  }
}

/**
 * Legacy grading function for backward compatibility
 * @param {string} studentText - The student's essay text
 * @param {string} prompt - The assignment prompt
 * @param {string} classProfile - The class profile identifier
 * @returns {Promise<Object>} Grading results
 */
async function gradeLegacy(studentText, prompt, classProfile) {
  console.log("\n⚡ STARTING SIMPLIFIED 3-STEP GRADING PROCESS...");
  const result = await gradeEssay(studentText, prompt, classProfile);
  console.log("\n✅ SIMPLIFIED GRADING COMPLETED SUCCESSFULLY!");
  return result;
}

export {
  gradeEssayUnified,
  gradeLegacy
};