/**
 * Response Standardization System
 *
 * Provides a consistent format for API responses across the entire application.
 * Includes success/error handling, metadata, pagination, and response transformation.
 * Ensures all API endpoints return responses in a standardized format.
 *
 * @example
 * const responseFormatter = new ResponseFormatter();
 * const response = responseFormatter.success(data, 'User created successfully');
 * res.json(response);
 */

/**
 * Standard API response structure
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Whether the operation was successful
 * @property {*} [data] - Response data (for successful operations)
 * @property {string} [message] - Human-readable message
 * @property {Array<Object>} [errors] - Array of error objects (for failed operations)
 * @property {Object} [metadata] - Additional metadata
 * @property {string} [requestId] - Unique request identifier
 * @property {string} timestamp - ISO timestamp of response
 * @property {number} [statusCode] - HTTP status code
 * @property {Object} [pagination] - Pagination information (for paginated responses)
 * @property {Object} [links] - HATEOAS links
 */

/**
 * Error detail object
 * @typedef {Object} ErrorDetail
 * @property {string} code - Error code
 * @property {string} message - Error message
 * @property {string} [field] - Field name (for validation errors)
 * @property {*} [value] - Value that caused the error
 * @property {Object} [metadata] - Additional error metadata
 */

/**
 * Pagination information
 * @typedef {Object} PaginationInfo
 * @property {number} page - Current page number
 * @property {number} limit - Items per page
 * @property {number} total - Total number of items
 * @property {number} pages - Total number of pages
 * @property {boolean} hasNext - Whether there's a next page
 * @property {boolean} hasPrev - Whether there's a previous page
 */

/**
 * Response formatter class
 */
class ResponseFormatter {
  constructor(options = {}) {
    this.options = {
      includeTimestamp: options.includeTimestamp !== false,
      includeRequestId: options.includeRequestId !== false,
      includeMetadata: options.includeMetadata !== false,
      enableHATEOAS: options.enableHATEOAS || false,
      defaultStatusCodes: {
        success: 200,
        created: 201,
        noContent: 204,
        badRequest: 400,
        unauthorized: 401,
        forbidden: 403,
        notFound: 404,
        conflict: 409,
        validationError: 422,
        serverError: 500,
        ...options.defaultStatusCodes
      },
      transformers: new Map(),
      ...options
    };

    this.logger = options.logger || console;
  }

  /**
   * Create a successful response
   *
   * @param {*} [data] - Response data
   * @param {string} [message] - Success message
   * @param {Object} [options={}] - Response options
   * @param {number} [options.statusCode] - HTTP status code
   * @param {Object} [options.metadata] - Additional metadata
   * @param {string} [options.requestId] - Request identifier
   * @param {Object} [options.pagination] - Pagination information
   * @param {Object} [options.links] - HATEOAS links
   * @returns {ApiResponse} Formatted response
   *
   * @example
   * formatter.success({ id: 1, name: 'John' }, 'User retrieved successfully');
   */
  success(data, message, options = {}) {
    const response = this._createBaseResponse(true, options);

    if (data !== undefined) {
      response.data = this._transformData(data, options.transform);
    }

    if (message) {
      response.message = message;
    }

    if (options.pagination) {
      response.pagination = this._formatPagination(options.pagination);
    }

    if (options.links && this.options.enableHATEOAS) {
      response.links = options.links;
    }

    response.statusCode = options.statusCode || this.options.defaultStatusCodes.success;

    return response;
  }

  /**
   * Create a created response (201)
   *
   * @param {*} data - Created resource data
   * @param {string} [message] - Creation message
   * @param {Object} [options={}] - Response options
   * @returns {ApiResponse} Formatted response
   */
  created(data, message = 'Resource created successfully', options = {}) {
    return this.success(data, message, {
      ...options,
      statusCode: this.options.defaultStatusCodes.created
    });
  }

  /**
   * Create a no content response (204)
   *
   * @param {string} [message] - Optional message
   * @param {Object} [options={}] - Response options
   * @returns {ApiResponse} Formatted response
   */
  noContent(message, options = {}) {
    return this.success(undefined, message, {
      ...options,
      statusCode: this.options.defaultStatusCodes.noContent
    });
  }

  /**
   * Create an error response
   *
   * @param {string|Error|Array<ErrorDetail>} error - Error information
   * @param {string} [message] - Error message
   * @param {Object} [options={}] - Response options
   * @param {number} [options.statusCode] - HTTP status code
   * @param {Object} [options.metadata] - Additional metadata
   * @param {string} [options.requestId] - Request identifier
   * @returns {ApiResponse} Formatted error response
   *
   * @example
   * formatter.error('User not found', 'Unable to retrieve user', { statusCode: 404 });
   */
  error(error, message, options = {}) {
    const response = this._createBaseResponse(false, options);

    response.errors = this._formatErrors(error);

    if (message) {
      response.message = message;
    } else if (typeof error === 'string') {
      response.message = error;
    } else if (error instanceof Error) {
      response.message = error.message;
    } else {
      response.message = 'An error occurred';
    }

    response.statusCode = options.statusCode || this._inferStatusCode(error) || this.options.defaultStatusCodes.serverError;

    return response;
  }

  /**
   * Create a bad request error response (400)
   *
   * @param {string|Error|Array<ErrorDetail>} error - Error information
   * @param {string} [message] - Error message
   * @param {Object} [options={}] - Response options
   * @returns {ApiResponse} Formatted error response
   */
  badRequest(error, message = 'Bad request', options = {}) {
    return this.error(error, message, {
      ...options,
      statusCode: this.options.defaultStatusCodes.badRequest
    });
  }

  /**
   * Create an unauthorized error response (401)
   *
   * @param {string} [message] - Error message
   * @param {Object} [options={}] - Response options
   * @returns {ApiResponse} Formatted error response
   */
  unauthorized(message = 'Unauthorized', options = {}) {
    return this.error('UNAUTHORIZED', message, {
      ...options,
      statusCode: this.options.defaultStatusCodes.unauthorized
    });
  }

  /**
   * Create a forbidden error response (403)
   *
   * @param {string} [message] - Error message
   * @param {Object} [options={}] - Response options
   * @returns {ApiResponse} Formatted error response
   */
  forbidden(message = 'Forbidden', options = {}) {
    return this.error('FORBIDDEN', message, {
      ...options,
      statusCode: this.options.defaultStatusCodes.forbidden
    });
  }

  /**
   * Create a not found error response (404)
   *
   * @param {string} [resource] - Resource that was not found
   * @param {Object} [options={}] - Response options
   * @returns {ApiResponse} Formatted error response
   */
  notFound(resource = 'Resource', options = {}) {
    return this.error('NOT_FOUND', `${resource} not found`, {
      ...options,
      statusCode: this.options.defaultStatusCodes.notFound
    });
  }

  /**
   * Create a conflict error response (409)
   *
   * @param {string|Error} error - Error information
   * @param {string} [message] - Error message
   * @param {Object} [options={}] - Response options
   * @returns {ApiResponse} Formatted error response
   */
  conflict(error, message = 'Resource conflict', options = {}) {
    return this.error(error, message, {
      ...options,
      statusCode: this.options.defaultStatusCodes.conflict
    });
  }

  /**
   * Create a validation error response (422)
   *
   * @param {Array<ErrorDetail>|Object} validationErrors - Validation errors
   * @param {string} [message] - Error message
   * @param {Object} [options={}] - Response options
   * @returns {ApiResponse} Formatted error response
   */
  validationError(validationErrors, message = 'Validation failed', options = {}) {
    return this.error(validationErrors, message, {
      ...options,
      statusCode: this.options.defaultStatusCodes.validationError
    });
  }

  /**
   * Create a server error response (500)
   *
   * @param {Error} error - Error object
   * @param {string} [message] - Error message
   * @param {Object} [options={}] - Response options
   * @returns {ApiResponse} Formatted error response
   */
  serverError(error, message = 'Internal server error', options = {}) {
    this.logger.error('[ResponseFormatter] Server error:', error);

    return this.error('INTERNAL_SERVER_ERROR', message, {
      ...options,
      statusCode: this.options.defaultStatusCodes.serverError,
      metadata: {
        ...options.metadata,
        errorId: this._generateErrorId(),
        // Don't expose internal error details in production
        ...(process.env.NODE_ENV !== 'production' && { internalError: error.message })
      }
    });
  }

  /**
   * Create a paginated response
   *
   * @param {Array} data - Array of data items
   * @param {PaginationInfo} pagination - Pagination information
   * @param {string} [message] - Success message
   * @param {Object} [options={}] - Response options
   * @returns {ApiResponse} Formatted paginated response
   */
  paginated(data, pagination, message, options = {}) {
    return this.success(data, message, {
      ...options,
      pagination: this._formatPagination(pagination)
    });
  }

  /**
   * Transform validation result to API response
   *
   * @param {Object} validationResult - Validation result from validation layer
   * @param {*} [data] - Data to include on success
   * @param {string} [successMessage] - Success message
   * @param {string} [errorMessage] - Error message
   * @returns {ApiResponse} Formatted response
   */
  fromValidation(validationResult, data, successMessage, errorMessage) {
    if (validationResult.isValid) {
      return this.success(data || validationResult.data, successMessage);
    } else {
      return this.validationError(validationResult.errors, errorMessage);
    }
  }

  /**
   * Register a data transformer
   *
   * @param {string} name - Transformer name
   * @param {Function} transformer - Transformer function
   */
  registerTransformer(name, transformer) {
    if (typeof transformer !== 'function') {
      throw new Error('Transformer must be a function');
    }
    this.options.transformers.set(name, transformer);
  }

  /**
   * Send formatted response
   *
   * @param {Object} res - Express response object
   * @param {ApiResponse} response - Formatted response
   */
  send(res, response) {
    const statusCode = response.statusCode || (response.success ? 200 : 500);
    res.status(statusCode).json(response);
  }

  /**
   * Create base response structure
   *
   * @private
   * @param {boolean} success - Whether operation was successful
   * @param {Object} options - Response options
   * @returns {Object} Base response object
   */
  _createBaseResponse(success, options = {}) {
    const response = { success };

    if (this.options.includeTimestamp) {
      response.timestamp = new Date().toISOString();
    }

    if (this.options.includeRequestId && options.requestId) {
      response.requestId = options.requestId;
    }

    if (this.options.includeMetadata && options.metadata) {
      response.metadata = options.metadata;
    }

    return response;
  }

  /**
   * Format errors into standard structure
   *
   * @private
   * @param {string|Error|Array<ErrorDetail>} error - Error to format
   * @returns {Array<ErrorDetail>} Formatted errors
   */
  _formatErrors(error) {
    if (Array.isArray(error)) {
      return error.map(err => this._formatSingleError(err));
    }

    return [this._formatSingleError(error)];
  }

  /**
   * Format a single error
   *
   * @private
   * @param {string|Error|ErrorDetail} error - Error to format
   * @returns {ErrorDetail} Formatted error
   */
  _formatSingleError(error) {
    if (typeof error === 'string') {
      return {
        code: error.toUpperCase().replace(/\s+/g, '_'),
        message: error
      };
    }

    if (error instanceof Error) {
      return {
        code: error.name || 'ERROR',
        message: error.message,
        ...(error.code && { code: error.code }),
        ...(error.field && { field: error.field }),
        ...(error.value !== undefined && { value: error.value }),
        ...(error.metadata && { metadata: error.metadata })
      };
    }

    if (typeof error === 'object' && error !== null) {
      return {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'An error occurred',
        ...(error.field && { field: error.field }),
        ...(error.value !== undefined && { value: error.value }),
        ...(error.metadata && { metadata: error.metadata })
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred'
    };
  }

  /**
   * Format pagination information
   *
   * @private
   * @param {PaginationInfo} pagination - Pagination info
   * @returns {PaginationInfo} Formatted pagination
   */
  _formatPagination(pagination) {
    return {
      page: pagination.page || 1,
      limit: pagination.limit || 10,
      total: pagination.total || 0,
      pages: Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
      hasNext: pagination.hasNext !== undefined ? pagination.hasNext :
        (pagination.page || 1) < Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
      hasPrev: pagination.hasPrev !== undefined ? pagination.hasPrev : (pagination.page || 1) > 1
    };
  }

  /**
   * Transform data using registered transformers
   *
   * @private
   * @param {*} data - Data to transform
   * @param {string|Function} [transformer] - Transformer name or function
   * @returns {*} Transformed data
   */
  _transformData(data, transformer) {
    if (!transformer) {
      return data;
    }

    if (typeof transformer === 'function') {
      return transformer(data);
    }

    if (typeof transformer === 'string' && this.options.transformers.has(transformer)) {
      const transformerFn = this.options.transformers.get(transformer);
      return transformerFn(data);
    }

    return data;
  }

  /**
   * Infer status code from error
   *
   * @private
   * @param {*} error - Error object
   * @returns {number|null} Status code or null
   */
  _inferStatusCode(error) {
    if (typeof error === 'object' && error !== null) {
      if (error.statusCode) {
        return error.statusCode;
      }

      if (error.code) {
        const codeMap = {
          'VALIDATION_ERROR': 422,
          'NOT_FOUND': 404,
          'UNAUTHORIZED': 401,
          'FORBIDDEN': 403,
          'CONFLICT': 409,
          'BAD_REQUEST': 400
        };
        return codeMap[error.code];
      }

      if (error.name) {
        const nameMap = {
          'ValidationError': 422,
          'NotFoundError': 404,
          'UnauthorizedError': 401,
          'ForbiddenError': 403,
          'ConflictError': 409
        };
        return nameMap[error.name];
      }
    }

    return null;
  }

  /**
   * Generate unique error ID
   *
   * @private
   * @returns {string} Error ID
   */
  _generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Express middleware for adding response formatter to requests
 *
 * @param {Object} [options={}] - Formatter options
 * @returns {Function} Express middleware
 */
function responseFormatterMiddleware(options = {}) {
  const formatter = new ResponseFormatter(options);

  return (req, res, next) => {
    // Add formatter to response object
    res.formatter = formatter;

    // Add convenience methods to response object
    res.success = (data, message, responseOptions = {}) => {
      const requestId = req.id || req.requestId;
      const response = formatter.success(data, message, { requestId, ...responseOptions });
      formatter.send(res, response);
    };

    res.created = (data, message, responseOptions = {}) => {
      const requestId = req.id || req.requestId;
      const response = formatter.created(data, message, { requestId, ...responseOptions });
      formatter.send(res, response);
    };

    res.error = (error, message, responseOptions = {}) => {
      const requestId = req.id || req.requestId;
      const response = formatter.error(error, message, { requestId, ...responseOptions });
      formatter.send(res, response);
    };

    res.validationError = (validationErrors, message, responseOptions = {}) => {
      const requestId = req.id || req.requestId;
      const response = formatter.validationError(validationErrors, message, { requestId, ...responseOptions });
      formatter.send(res, response);
    };

    res.notFound = (resource, responseOptions = {}) => {
      const requestId = req.id || req.requestId;
      const response = formatter.notFound(resource, { requestId, ...responseOptions });
      formatter.send(res, response);
    };

    res.serverError = (error, message, responseOptions = {}) => {
      const requestId = req.id || req.requestId;
      const response = formatter.serverError(error, message, { requestId, ...responseOptions });
      formatter.send(res, response);
    };

    res.paginated = (data, pagination, message, responseOptions = {}) => {
      const requestId = req.id || req.requestId;
      const response = formatter.paginated(data, pagination, message, { requestId, ...responseOptions });
      formatter.send(res, response);
    };

    next();
  };
}

/**
 * Global response formatter instance
 */
let globalFormatter = null;

/**
 * Get or create global response formatter
 *
 * @param {Object} [options] - Formatter options
 * @returns {ResponseFormatter} Global formatter
 */
function getGlobalFormatter(options) {
  if (!globalFormatter) {
    globalFormatter = new ResponseFormatter(options);
  }
  return globalFormatter;
}

/**
 * Set global response formatter
 *
 * @param {ResponseFormatter} formatter - Formatter to set as global
 */
function setGlobalFormatter(formatter) {
  if (!(formatter instanceof ResponseFormatter)) {
    throw new Error('Global formatter must be an instance of ResponseFormatter');
  }
  globalFormatter = formatter;
}

export {
  ResponseFormatter,
  responseFormatterMiddleware,
  getGlobalFormatter,
  setGlobalFormatter
};