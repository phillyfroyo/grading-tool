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

      // Also set signed cookies as backup for Vercel serverless environment
      res.cookie('userId', user.id, {
        signed: true,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
      });
      res.cookie('userEmail', user.email, {
        signed: true,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
      });

      console.log(`[AUTH] User logged in: ${user.email} (session + cookies set)`);

      // Ensure session is saved before responding
      req.session.save((err) => {
        if (err) {
          console.error('[AUTH] Session save error:', err);
          // Continue anyway - session might still work with memory store
        }

        console.log('[AUTH] Session save completed');
        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email
          },
          message: 'Login successful'
        });
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

        // Clear all cookies
        res.clearCookie('connect.sid');
        res.clearCookie('sessionId');
        res.clearCookie('userId');
        res.clearCookie('userEmail');

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
      // Check session first, then cookies
      let userId = req.session?.userId;
      let userEmail = req.session?.userEmail;

      if (!userId && req.signedCookies) {
        userId = req.signedCookies.userId;
        userEmail = req.signedCookies.userEmail;
        console.log('[AUTH_STATUS] Using signed cookies for auth check');
      }

      console.log('[AUTH_STATUS] Auth check:', {
        hasSession: !!req.session,
        sessionUserId: req.session?.userId,
        cookieUserId: req.signedCookies?.userId,
        finalUserId: userId
      });

      if (!userId) {
        console.log('[AUTH_STATUS] No userId found, returning unauthenticated');
        return res.json({
          success: true,
          authenticated: false
        });
      }

      // Try to get user from database, fallback to auth data
      let user = null;
      try {
        user = await this.userService.getUserById(userId);
      } catch (dbError) {
        console.warn('[AUTH] Database unavailable for status check, using auth data');
        // Use available data as fallback
        user = {
          id: userId,
          email: userEmail
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