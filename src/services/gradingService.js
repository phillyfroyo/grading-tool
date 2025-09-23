// Grading service
// Contains the unified grading logic for both local and Vercel environments

import { gradeEssay } from "../../grader/grader-two-step.js";

/**
 * Unified grading function that works identically in local and Vercel environments
 * @param {string} studentText - The student's essay text
 * @param {string} prompt - The assignment prompt
 * @param {Object} profileData - The class profile data
 * @returns {Promise<Object>} Grading results
 */
async function gradeEssayUnified(studentText, prompt, profileData) {
  console.log('=== STARTING UNIFIED TWO-STEP GRADING ===');
  console.log('Profile:', profileData.name);
  console.log('Student text length:', studentText?.length);

  try {
    // Use the improved two-step grader with atomic error highlighting
    console.log('🚀 Using improved grader-two-step.js with atomic error highlighting...');
    const result = await gradeEssay(studentText, prompt, profileData.id);
    console.log('✅ Unified grading completed successfully!');
    return result;
  } catch (error) {
    console.error('❌ Error in unified grading:', error);
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
  console.log("\n⚡ STARTING TWO-STEP GRADING PROCESS...");
  const result = await gradeEssay(studentText, prompt, classProfile);
  console.log("\n✅ GRADING COMPLETED SUCCESSFULLY!");
  return result;
}

export {
  gradeEssayUnified,
  gradeLegacy
};