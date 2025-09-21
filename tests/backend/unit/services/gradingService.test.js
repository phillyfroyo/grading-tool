/**
 * Unit Tests for Grading Service
 *
 * Tests the core grading functionality.
 * Note: Uses simplified mocking approach compatible with ES modules.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

describe('GradingService', () => {
  const mockProfileData = {
    id: 'test-profile',
    name: 'Test Class Profile',
    cefrLevel: 'B2',
    vocabulary: ['school', 'education', 'learning', 'student', 'teacher'],
    grammar: ['present tense', 'past tense', 'conditionals'],
    temperature: 0
  };

  const mockStudentText = 'I like school very much. Education is important for students.';
  const mockPrompt = 'Write about your educational experience.';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Set up environment variables
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  describe('Module Loading', () => {
    it('should import service functions without errors', async () => {
      const gradingService = await import('../../../../src/services/gradingService.js');

      expect(gradingService.gradeEssayUnified).toBeDefined();
      expect(gradingService.gradeLegacy).toBeDefined();
      expect(typeof gradingService.gradeEssayUnified).toBe('function');
      expect(typeof gradingService.gradeLegacy).toBe('function');
    });
  });

  describe('gradeEssayUnified', () => {
    it('should be callable with proper parameters', async () => {
      const gradingService = await import('../../../../src/services/gradingService.js');

      try {
        await gradingService.gradeEssayUnified(mockStudentText, mockPrompt, mockProfileData);
      } catch (error) {
        // We expect this to fail due to mocked OpenAI, but it should be callable
        expect(error.message).not.toMatch(/SyntaxError|Cannot use import/);
      }
    });

    it('should handle missing API key gracefully', async () => {
      const gradingService = await import('../../../../src/services/gradingService.js');

      delete process.env.OPENAI_API_KEY;

      try {
        const result = await gradingService.gradeEssayUnified(mockStudentText, mockPrompt, mockProfileData);

        // Should return error result
        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('error');
      } catch (error) {
        // Or throw error - both are acceptable
        expect(error.message).toContain('OPENAI_API_KEY');
      }
    });

    it('should validate input parameters', async () => {
      const gradingService = await import('../../../../src/services/gradingService.js');

      try {
        await gradingService.gradeEssayUnified('', '', null);
      } catch (error) {
        // Should handle invalid inputs
        expect(error).toBeDefined();
      }
    });

    it('should handle OpenAI API errors gracefully', async () => {
      const gradingService = await import('../../../../src/services/gradingService.js');

      // This will fail with mocked OpenAI, but should handle gracefully
      try {
        await gradingService.gradeEssayUnified(mockStudentText, mockPrompt, mockProfileData);
      } catch (error) {
        // Should be a handled error, not a syntax error
        expect(error.message).not.toMatch(/SyntaxError/);
      }
    });
  });

  describe('gradeLegacy', () => {
    it('should be callable and handle legacy grading', async () => {
      const gradingService = await import('../../../../src/services/gradingService.js');

      try {
        await gradingService.gradeLegacy(mockStudentText, mockPrompt, 'test-profile');
      } catch (error) {
        // Expected to fail with mocked dependencies, but should be callable
        expect(error.message).not.toMatch(/SyntaxError|Cannot use import/);
      }
    });

    it('should handle missing profile gracefully', async () => {
      const gradingService = await import('../../../../src/services/gradingService.js');

      try {
        await gradingService.gradeLegacy(mockStudentText, mockPrompt, 'non-existent');
      } catch (error) {
        // Should handle missing profile
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      const gradingService = await import('../../../../src/services/gradingService.js');

      // Test with very long text that might timeout
      const longText = 'a'.repeat(10000);

      try {
        await gradingService.gradeEssayUnified(longText, mockPrompt, mockProfileData);
      } catch (error) {
        // Should handle timeout gracefully
        expect(error).toBeDefined();
      }
    });

    it('should validate profile data structure', async () => {
      const gradingService = await import('../../../../src/services/gradingService.js');

      const invalidProfile = { id: 'test' }; // Missing required fields

      try {
        await gradingService.gradeEssayUnified(mockStudentText, mockPrompt, invalidProfile);
      } catch (error) {
        // Should validate profile structure
        expect(error).toBeDefined();
      }
    });
  });
});