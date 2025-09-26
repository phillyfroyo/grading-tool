/**
 * User service for managing user authentication and operations
 */

class UserService {
  constructor() {
    console.log('[USER_SERVICE] Constructor initialized');
  }

  /**
   * Get Prisma client with runtime check
   */
  async getPrismaClient() {
    try {
      console.log('[USER_SERVICE] Attempting to import Prisma client...');
      const { prisma } = await import('../../lib/prisma.js');
      console.log('[USER_SERVICE] Prisma import successful, client:', !!prisma);
      console.log('[USER_SERVICE] Prisma client type:', typeof prisma);
      return prisma;
    } catch (error) {
      console.error('[USER_SERVICE] Failed to import Prisma client:', error.message);
      console.error('[USER_SERVICE] Full error:', error);
      return null;
    }
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async findUserByEmail(email) {
    const prisma = await this.getPrismaClient();
    if (!prisma) {
      throw new Error('Database not available');
    }

    if (!prisma.user) {
      throw new Error('User model not available in database');
    }

    try {
      const user = await prisma.user.findUnique({
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
    const prisma = await this.getPrismaClient();
    if (!prisma) {
      throw new Error('Database not available');
    }

    try {
      const user = await prisma.user.create({
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
    const prisma = await this.getPrismaClient();
    if (!prisma) {
      throw new Error('Database not available');
    }

    try {
      const user = await prisma.user.findUnique({
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