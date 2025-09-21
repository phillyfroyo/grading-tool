/**
 * Authentication middleware
 */

/**
 * Middleware to check if user is authenticated
 */
export function requireAuth(req, res, next) {
  if (!req.session.userId) {
    // Check if this is an API request or HTML request
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        redirect: '/login'
      });
    } else {
      // HTML request - redirect to login page
      return res.redirect('/login');
    }
  }
  next();
}

/**
 * Middleware to redirect authenticated users away from login page
 */
export function redirectIfAuthenticated(req, res, next) {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  next();
}

/**
 * Middleware to attach user info to request for authenticated users
 */
export function attachUser(req, res, next) {
  if (req.session.userId) {
    req.user = {
      id: req.session.userId,
      email: req.session.userEmail
    };
  }
  next();
}