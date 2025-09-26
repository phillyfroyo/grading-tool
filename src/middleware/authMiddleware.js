/**
 * Authentication middleware
 */

/**
 * Middleware to check if user is authenticated
 */
export function requireAuth(req, res, next) {
  // Check session first, then fall back to signed cookies
  let userId = req.session?.userId;
  let userEmail = req.session?.userEmail;

  // Fallback to signed cookies if session is not available
  if (!userId && req.signedCookies) {
    userId = req.signedCookies.userId;
    userEmail = req.signedCookies.userEmail;
    console.log('[AUTH] Session not found, using signed cookies:', { userId: !!userId, userEmail: !!userEmail });
  }

  if (!userId) {
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
  let userId = req.session?.userId;
  let userEmail = req.session?.userEmail;

  // Fallback to signed cookies
  if (!userId && req.signedCookies) {
    userId = req.signedCookies.userId;
    userEmail = req.signedCookies.userEmail;
  }

  if (userId) {
    req.user = {
      id: userId,
      email: userEmail
    };
  }
  next();
}