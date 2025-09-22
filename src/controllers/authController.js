/**
 * Authentication controller for handling user login/registration
 */

import UserService from '../services/userService.js';

class AuthController {
  constructor() {
    this.userService = new UserService();
  }

  /**
   * Handle user login/registration
   */
  async login(req, res) {
    try {
      console.log('[AUTH_CONTROLLER] Login attempt:', req.body);
      const { email } = req.body;

      if (!email) {
        console.log('[AUTH_CONTROLLER] No email provided');
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        });
      }

      console.log('[AUTH_CONTROLLER] Attempting to login/register user:', email);

      // TEMPORARY: Create mock user for testing
      const user = {
        id: 'temp-user-' + Date.now(),
        email: email.toLowerCase(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      console.log('[AUTH_CONTROLLER] Created mock user:', user);

      // Try to use real database, fallback to mock
      try {
        const realUser = await this.userService.loginOrRegister(email);
        console.log('[AUTH_CONTROLLER] Using real database user');
        user.id = realUser.id;
        user.createdAt = realUser.createdAt;
        user.updatedAt = realUser.updatedAt;
      } catch (dbError) {
        console.warn('[AUTH_CONTROLLER] Database unavailable, using mock user:', dbError.message);
      }

      // Set user session
      req.session.userId = user.id;
      req.session.userEmail = user.email;

      console.log(`[AUTH] User logged in: ${user.email}`);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email
        },
        message: 'Login successful'
      });

    } catch (error) {
      console.error('[AUTH] Login error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Login failed'
      });
    }
  }

  /**
   * Handle user logout
   */
  async logout(req, res) {
    try {
      req.session.destroy((err) => {
        if (err) {
          console.error('[AUTH] Logout error:', err);
          return res.status(500).json({
            success: false,
            error: 'Logout failed'
          });
        }

        res.clearCookie('connect.sid');
        res.json({
          success: true,
          message: 'Logout successful'
        });
      });
    } catch (error) {
      console.error('[AUTH] Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  }

  /**
   * Check authentication status
   */
  async status(req, res) {
    try {
      console.log('[AUTH_STATUS] Session check:', {
        hasSession: !!req.session,
        sessionId: req.session?.id,
        userId: req.session?.userId,
        userEmail: req.session?.userEmail
      });

      if (!req.session.userId) {
        console.log('[AUTH_STATUS] No userId in session, returning unauthenticated');
        return res.json({
          success: true,
          authenticated: false
        });
      }

      // Try to get user from database, fallback to session data
      let user = null;
      try {
        user = await this.userService.getUserById(req.session.userId);
      } catch (dbError) {
        console.warn('[AUTH] Database unavailable for status check, using session data');
        // Use session data as fallback
        user = {
          id: req.session.userId,
          email: req.session.userEmail
        };
      }

      if (!user || !user.email) {
        // User was deleted or invalid session, clear session
        req.session.destroy();
        return res.json({
          success: true,
          authenticated: false
        });
      }

      res.json({
        success: true,
        authenticated: true,
        user: {
          id: user.id,
          email: user.email
        }
      });

    } catch (error) {
      console.error('[AUTH] Status check error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication status check failed'
      });
    }
  }
}

export default AuthController;