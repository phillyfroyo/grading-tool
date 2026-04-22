// Error handling middleware
// Provides centralized error handling for the application

/**
 * Generic error handler middleware
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, next) {
  console.error('❌ ERROR HANDLER CAUGHT:', err.message);
  console.error('Error stack:', err.stack);

  // /v1/* is the public API and uses a {error:{code,message}} envelope.
  // body-parser throws entity.parse.failed before route-level middleware can
  // catch it, so classify it here for /v1 and return the documented 400.
  const isPublicApi = req.path?.startsWith('/v1/');
  const isJsonParseError =
    err?.type === 'entity.parse.failed' || err instanceof SyntaxError;

  if (isPublicApi && isJsonParseError) {
    return res.status(400).json({
      error: { code: 'invalid_request', message: 'Request body is not valid JSON' },
    });
  }

  // Default error response
  let statusCode = 500;
  let errorResponse = {
    success: false,
    error: 'Internal server error',
    details: err.message
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorResponse.error = 'Validation error';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorResponse.error = 'Unauthorized access';
  } else if (err.code === 'P2025') {
    // Prisma "Record not found" error
    statusCode = 404;
    errorResponse.error = 'Resource not found';
  } else if (err.code === 'P2002') {
    // Prisma unique constraint error
    statusCode = 409;
    errorResponse.error = 'Resource already exists';
  }

  // Add debug information in development
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.debug = {
      errorType: err.constructor.name,
      stack: err.stack,
      timestamp: new Date().toISOString()
    };
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Handle async errors in route handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function that catches async errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
}

export {
  errorHandler,
  asyncHandler,
  notFoundHandler
};