/**
 * Authentication middleware
 */

/**
 * Middleware to check if user is authenticated
 */
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    // Check if this is an API request or HTML request
    // Check the URL path, XHR header, or Accept header
    const isApiRequest = req.path.startsWith('/api/') ||
                         req.xhr ||
                         req.headers.accept?.includes('application/json') ||
                         req.headers['content-type']?.includes('application/json');

    if (isApiRequest) {
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
  console.log('[AUTH_MIDDLEWARE] redirectIfAuthenticated check for:', req.path, 'Session:', !!req.session.userId);
  if (req.session.userId) {
    console.log('[AUTH_MIDDLEWARE] User authenticated, redirecting to main interface');
    return res.redirect('/');
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