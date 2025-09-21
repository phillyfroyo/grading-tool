/**
 * User service for managing user authentication and operations
 */

import { prisma } from '../../lib/prisma.js';

class UserService {
  constructor() {
    this.prisma = prisma;
    console.log('[USER_SERVICE] Constructor - prisma instance:', !!this.prisma);
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async findUserByEmail(email) {
    if (!this.prisma) {
      throw new Error('Database not available');
    }

    if (!this.prisma.user) {
      throw new Error('User model not available in database');
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });
      return user;
    } catch (error) {
      console.error('[USER_SERVICE] Error finding user by email:', error);
      throw error;
    }
  }

  /**
   * Create new user with email
   * @param {string} email - User email
   * @returns {Promise<Object>} Created user object
   */
  async createUser(email) {
    console.log('[USER_SERVICE] Creating user:', email);
    if (!this.prisma) {
      throw new Error('Database not available');
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email: email.toLowerCase()
        }
      });
      console.log(`[USER_SERVICE] Created new user: ${email}`);
      return user;
    } catch (error) {
      console.error('[USER_SERVICE] Error creating user:', error);
      throw error;
    }
  }

  /**
   * Login or register user with email
   * @param {string} email - User email
   * @returns {Promise<Object>} User object
   */
  async loginOrRegister(email) {
    if (!email || typeof email !== 'string') {
      throw new Error('Valid email is required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    try {
      // Try to find existing user
      let user = await this.findUserByEmail(email);

      // If user doesn't exist, create new one
      if (!user) {
        user = await this.createUser(email);
      }

      return user;
    } catch (error) {
      console.error('[USER_SERVICE] Error in loginOrRegister:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async getUserById(userId) {
    console.log('[USER_SERVICE] Getting user by ID:', userId);
    if (!this.prisma) {
      throw new Error('Database not available');
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });
      return user;
    } catch (error) {
      console.error('[USER_SERVICE] Error finding user by ID:', error);
      throw error;
    }
  }
}

export default UserService;