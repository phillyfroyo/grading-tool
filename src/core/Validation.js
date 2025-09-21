/**
 * Validation Layer with Schema Validation
 *
 * A comprehensive validation system that provides schema-based validation,
 * custom validators, sanitization, and error handling. Supports both
 * synchronous and asynchronous validation with detailed error reporting.
 *
 * @example
 * const schema = new ValidationSchema({
 *   name: [required(), string(), minLength(2)],
 *   email: [required(), email()],
 *   age: [number(), min(0), max(120)]
 * });
 *
 * const result = await schema.validate(data);
 * if (!result.isValid) {
 *   console.log(result.errors);
 * }
 */

/**
 * Validation result
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether validation passed
 * @property {Object} data - Validated/sanitized data
 * @property {Array<ValidationError>} errors - Validation errors
 * @property {Array<string>} warnings - Validation warnings
 * @property {Object} metadata - Additional validation metadata
 */

/**
 * Validation error
 * @typedef {Object} ValidationError
 * @property {string} field - Field name
 * @property {string} code - Error code
 * @property {string} message - Error message
 * @property {*} value - Value that failed validation
 * @property {Object} [metadata] - Additional error metadata
 */

/**
 * Validator function
 * @typedef {Function} Validator
 * @param {*} value - Value to validate
 * @param {Object} context - Validation context
 * @returns {ValidationResult|Promise<ValidationResult>} Validation result
 */

/**
 * Sanitizer function
 * @typedef {Function} Sanitizer
 * @param {*} value - Value to sanitize
 * @param {Object} context - Sanitization context
 * @returns {*} Sanitized value
 */

/**
 * Validation error class
 */
class ValidationError extends Error {
  constructor(field, code, message, value, metadata = {}) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = code;
    this.value = value;
    this.metadata = metadata;
  }

  toJSON() {
    return {
      field: this.field,
      code: this.code,
      message: this.message,
      value: this.value,
      metadata: this.metadata
    };
  }
}

/**
 * Validation context
 */
class ValidationContext {
  constructor(data, options = {}) {
    this.data = data;
    this.options = options;
    this.errors = [];
    this.warnings = [];
    this.sanitizedData = {};
    this.fieldPath = [];
    this.metadata = {};
  }

  /**
   * Add validation error
   * @param {string} field - Field name
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {*} value - Value that failed
   * @param {Object} metadata - Additional metadata
   */
  addError(field, code, message, value, metadata = {}) {
    this.errors.push(new ValidationError(field, code, message, value, metadata));
  }

  /**
   * Add validation warning
   * @param {string} field - Field name
   * @param {string} message - Warning message
   */
  addWarning(field, message) {
    this.warnings.push({ field, message });
  }

  /**
   * Get current field path as string
   * @returns {string} Field path
   */
  getCurrentPath() {
    return this.fieldPath.join('.');
  }

  /**
   * Push field to path
   * @param {string} field - Field name
   */
  pushPath(field) {
    this.fieldPath.push(field);
  }

  /**
   * Pop field from path
   */
  popPath() {
    this.fieldPath.pop();
  }

  /**
   * Check if validation has errors
   * @returns {boolean} True if has errors
   */
  hasErrors() {
    return this.errors.length > 0;
  }

  /**
   * Get validation result
   * @returns {ValidationResult} Validation result
   */
  getResult() {
    return {
      isValid: !this.hasErrors(),
      data: this.sanitizedData,
      errors: this.errors.map(error => error.toJSON()),
      warnings: this.warnings,
      metadata: this.metadata
    };
  }
}

/**
 * Validation schema class
 */
class ValidationSchema {
  constructor(schema, options = {}) {
    this.schema = schema;
    this.options = {
      abortEarly: options.abortEarly || false,
      allowUnknown: options.allowUnknown || false,
      stripUnknown: options.stripUnknown || false,
      sanitize: options.sanitize !== false,
      context: options.context || {},
      ...options
    };
  }

  /**
   * Validate data against schema
   * @param {Object} data - Data to validate
   * @param {Object} [options={}] - Validation options
   * @returns {Promise<ValidationResult>} Validation result
   */
  async validate(data, options = {}) {
    const mergedOptions = { ...this.options, ...options };
    const context = new ValidationContext(data, mergedOptions);

    try {
      await this._validateObject(data, this.schema, context);

      // Handle unknown fields
      if (!mergedOptions.allowUnknown) {
        this._checkUnknownFields(data, this.schema, context);
      }

      return context.getResult();
    } catch (error) {
      context.addError('', 'VALIDATION_ERROR', error.message, data);
      return context.getResult();
    }
  }

  /**
   * Validate data synchronously
   * @param {Object} data - Data to validate
   * @param {Object} [options={}] - Validation options
   * @returns {ValidationResult} Validation result
   */
  validateSync(data, options = {}) {
    const mergedOptions = { ...this.options, ...options };
    const context = new ValidationContext(data, mergedOptions);

    try {
      this._validateObjectSync(data, this.schema, context);

      if (!mergedOptions.allowUnknown) {
        this._checkUnknownFields(data, this.schema, context);
      }

      return context.getResult();
    } catch (error) {
      context.addError('', 'VALIDATION_ERROR', error.message, data);
      return context.getResult();
    }
  }

  /**
   * Validate object against schema
   * @private
   * @param {Object} data - Data to validate
   * @param {Object} schema - Schema to validate against
   * @param {ValidationContext} context - Validation context
   */
  async _validateObject(data, schema, context) {
    if (!data || typeof data !== 'object') {
      context.addError('', 'INVALID_TYPE', 'Expected object', data);
      return;
    }

    context.sanitizedData = context.options.stripUnknown ? {} : { ...data };

    for (const [field, validators] of Object.entries(schema)) {
      if (context.options.abortEarly && context.hasErrors()) {
        break;
      }

      context.pushPath(field);
      const value = data[field];

      try {
        const validatedValue = await this._validateField(value, validators, context);
        if (validatedValue !== undefined) {
          this._setNestedValue(context.sanitizedData, field, validatedValue);
        }
      } catch (error) {
        context.addError(context.getCurrentPath(), 'VALIDATION_ERROR', error.message, value);
      }

      context.popPath();
    }
  }

  /**
   * Validate object synchronously
   * @private
   * @param {Object} data - Data to validate
   * @param {Object} schema - Schema to validate against
   * @param {ValidationContext} context - Validation context
   */
  _validateObjectSync(data, schema, context) {
    if (!data || typeof data !== 'object') {
      context.addError('', 'INVALID_TYPE', 'Expected object', data);
      return;
    }

    context.sanitizedData = context.options.stripUnknown ? {} : { ...data };

    for (const [field, validators] of Object.entries(schema)) {
      if (context.options.abortEarly && context.hasErrors()) {
        break;
      }

      context.pushPath(field);
      const value = data[field];

      try {
        const validatedValue = this._validateFieldSync(value, validators, context);
        if (validatedValue !== undefined) {
          this._setNestedValue(context.sanitizedData, field, validatedValue);
        }
      } catch (error) {
        context.addError(context.getCurrentPath(), 'VALIDATION_ERROR', error.message, value);
      }

      context.popPath();
    }
  }

  /**
   * Validate a single field
   * @private
   * @param {*} value - Value to validate
   * @param {Array<Validator>} validators - Array of validators
   * @param {ValidationContext} context - Validation context
   * @returns {Promise<*>} Validated value
   */
  async _validateField(value, validators, context) {
    let currentValue = value;

    for (const validator of validators) {
      if (typeof validator === 'function') {
        const result = await validator(currentValue, context);
        if (result && typeof result === 'object') {
          if (!result.isValid) {
            const error = result.error || 'Validation failed';
            context.addError(context.getCurrentPath(), result.code || 'VALIDATION_ERROR', error, currentValue);
            if (context.options.abortEarly) {
              break;
            }
          } else if (result.value !== undefined) {
            currentValue = result.value;
          }
        } else if (result === false) {
          context.addError(context.getCurrentPath(), 'VALIDATION_ERROR', 'Validation failed', currentValue);
          if (context.options.abortEarly) {
            break;
          }
        }
      }
    }

    return currentValue;
  }

  /**
   * Validate a single field synchronously
   * @private
   * @param {*} value - Value to validate
   * @param {Array<Validator>} validators - Array of validators
   * @param {ValidationContext} context - Validation context
   * @returns {*} Validated value
   */
  _validateFieldSync(value, validators, context) {
    let currentValue = value;

    for (const validator of validators) {
      if (typeof validator === 'function') {
        const result = validator(currentValue, context);

        // Handle promise results (skip async validators in sync mode)
        if (result && typeof result.then === 'function') {
          context.addWarning(context.getCurrentPath(), 'Async validator skipped in sync validation');
          continue;
        }

        if (result && typeof result === 'object') {
          if (!result.isValid) {
            const error = result.error || 'Validation failed';
            context.addError(context.getCurrentPath(), result.code || 'VALIDATION_ERROR', error, currentValue);
            if (context.options.abortEarly) {
              break;
            }
          } else if (result.value !== undefined) {
            currentValue = result.value;
          }
        } else if (result === false) {
          context.addError(context.getCurrentPath(), 'VALIDATION_ERROR', 'Validation failed', currentValue);
          if (context.options.abortEarly) {
            break;
          }
        }
      }
    }

    return currentValue;
  }

  /**
   * Check for unknown fields
   * @private
   * @param {Object} data - Data to check
   * @param {Object} schema - Schema definition
   * @param {ValidationContext} context - Validation context
   */
  _checkUnknownFields(data, schema, context) {
    for (const field in data) {
      if (!(field in schema)) {
        context.addError(field, 'UNKNOWN_FIELD', `Unknown field: ${field}`, data[field]);
      }
    }
  }

  /**
   * Set nested value in object
   * @private
   * @param {Object} obj - Object to set value in
   * @param {string} path - Path to set
   * @param {*} value - Value to set
   */
  _setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }
}

// ============ BUILT-IN VALIDATORS ============

/**
 * Required field validator
 * @param {string} [message] - Custom error message
 * @returns {Validator} Validator function
 */
function required(message = 'This field is required') {
  return (value, context) => {
    const isValid = value !== undefined && value !== null && value !== '';
    return {
      isValid,
      error: isValid ? null : message,
      code: 'REQUIRED'
    };
  };
}

/**
 * String type validator
 * @param {string} [message] - Custom error message
 * @returns {Validator} Validator function
 */
function string(message = 'Must be a string') {
  return (value, context) => {
    if (value === undefined || value === null) {
      return { isValid: true, value };
    }

    const isValid = typeof value === 'string';
    return {
      isValid,
      error: isValid ? null : message,
      code: 'INVALID_TYPE',
      value: isValid ? value : value
    };
  };
}

/**
 * Number type validator
 * @param {string} [message] - Custom error message
 * @returns {Validator} Validator function
 */
function number(message = 'Must be a number') {
  return (value, context) => {
    if (value === undefined || value === null) {
      return { isValid: true, value };
    }

    let numValue = value;
    if (typeof value === 'string') {
      numValue = parseFloat(value);
    }

    const isValid = typeof numValue === 'number' && !isNaN(numValue);
    return {
      isValid,
      error: isValid ? null : message,
      code: 'INVALID_TYPE',
      value: isValid ? numValue : value
    };
  };
}

/**
 * Boolean type validator
 * @param {string} [message] - Custom error message
 * @returns {Validator} Validator function
 */
function boolean(message = 'Must be a boolean') {
  return (value, context) => {
    if (value === undefined || value === null) {
      return { isValid: true, value };
    }

    let boolValue = value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1') {
        boolValue = true;
      } else if (lower === 'false' || lower === '0') {
        boolValue = false;
      }
    }

    const isValid = typeof boolValue === 'boolean';
    return {
      isValid,
      error: isValid ? null : message,
      code: 'INVALID_TYPE',
      value: isValid ? boolValue : value
    };
  };
}

/**
 * Email validator
 * @param {string} [message] - Custom error message
 * @returns {Validator} Validator function
 */
function email(message = 'Must be a valid email address') {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return (value, context) => {
    if (value === undefined || value === null || value === '') {
      return { isValid: true, value };
    }

    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: message,
        code: 'INVALID_EMAIL'
      };
    }

    const isValid = emailRegex.test(value);
    return {
      isValid,
      error: isValid ? null : message,
      code: 'INVALID_EMAIL'
    };
  };
}

/**
 * Minimum length validator
 * @param {number} min - Minimum length
 * @param {string} [message] - Custom error message
 * @returns {Validator} Validator function
 */
function minLength(min, message) {
  const defaultMessage = `Must be at least ${min} characters long`;

  return (value, context) => {
    if (value === undefined || value === null) {
      return { isValid: true, value };
    }

    const length = typeof value === 'string' ? value.length : String(value).length;
    const isValid = length >= min;

    return {
      isValid,
      error: isValid ? null : (message || defaultMessage),
      code: 'MIN_LENGTH'
    };
  };
}

/**
 * Maximum length validator
 * @param {number} max - Maximum length
 * @param {string} [message] - Custom error message
 * @returns {Validator} Validator function
 */
function maxLength(max, message) {
  const defaultMessage = `Must be no more than ${max} characters long`;

  return (value, context) => {
    if (value === undefined || value === null) {
      return { isValid: true, value };
    }

    const length = typeof value === 'string' ? value.length : String(value).length;
    const isValid = length <= max;

    return {
      isValid,
      error: isValid ? null : (message || defaultMessage),
      code: 'MAX_LENGTH'
    };
  };
}

/**
 * Minimum value validator
 * @param {number} min - Minimum value
 * @param {string} [message] - Custom error message
 * @returns {Validator} Validator function
 */
function min(min, message) {
  const defaultMessage = `Must be at least ${min}`;

  return (value, context) => {
    if (value === undefined || value === null) {
      return { isValid: true, value };
    }

    const numValue = typeof value === 'number' ? value : parseFloat(value);
    const isValid = !isNaN(numValue) && numValue >= min;

    return {
      isValid,
      error: isValid ? null : (message || defaultMessage),
      code: 'MIN_VALUE'
    };
  };
}

/**
 * Maximum value validator
 * @param {number} max - Maximum value
 * @param {string} [message] - Custom error message
 * @returns {Validator} Validator function
 */
function max(max, message) {
  const defaultMessage = `Must be no more than ${max}`;

  return (value, context) => {
    if (value === undefined || value === null) {
      return { isValid: true, value };
    }

    const numValue = typeof value === 'number' ? value : parseFloat(value);
    const isValid = !isNaN(numValue) && numValue <= max;

    return {
      isValid,
      error: isValid ? null : (message || defaultMessage),
      code: 'MAX_VALUE'
    };
  };
}

/**
 * Pattern/regex validator
 * @param {RegExp} pattern - Regular expression pattern
 * @param {string} [message] - Custom error message
 * @returns {Validator} Validator function
 */
function pattern(pattern, message = 'Does not match required pattern') {
  return (value, context) => {
    if (value === undefined || value === null || value === '') {
      return { isValid: true, value };
    }

    const stringValue = String(value);
    const isValid = pattern.test(stringValue);

    return {
      isValid,
      error: isValid ? null : message,
      code: 'PATTERN_MISMATCH'
    };
  };
}

/**
 * Enum/options validator
 * @param {Array} options - Valid options
 * @param {string} [message] - Custom error message
 * @returns {Validator} Validator function
 */
function oneOf(options, message) {
  const defaultMessage = `Must be one of: ${options.join(', ')}`;

  return (value, context) => {
    if (value === undefined || value === null) {
      return { isValid: true, value };
    }

    const isValid = options.includes(value);

    return {
      isValid,
      error: isValid ? null : (message || defaultMessage),
      code: 'INVALID_OPTION'
    };
  };
}

/**
 * Custom validator wrapper
 * @param {Function} validatorFn - Custom validator function
 * @param {string} [message] - Custom error message
 * @param {string} [code] - Error code
 * @returns {Validator} Validator function
 */
function custom(validatorFn, message = 'Custom validation failed', code = 'CUSTOM_ERROR') {
  return async (value, context) => {
    try {
      const result = await validatorFn(value, context);

      if (typeof result === 'boolean') {
        return {
          isValid: result,
          error: result ? null : message,
          code: result ? null : code
        };
      }

      return result;
    } catch (error) {
      return {
        isValid: false,
        error: error.message || message,
        code: 'CUSTOM_ERROR'
      };
    }
  };
}

// ============ SANITIZERS ============

/**
 * Trim whitespace sanitizer
 * @returns {Validator} Sanitizer function
 */
function trim() {
  return (value, context) => {
    if (typeof value === 'string') {
      return { isValid: true, value: value.trim() };
    }
    return { isValid: true, value };
  };
}

/**
 * Lowercase sanitizer
 * @returns {Validator} Sanitizer function
 */
function toLowerCase() {
  return (value, context) => {
    if (typeof value === 'string') {
      return { isValid: true, value: value.toLowerCase() };
    }
    return { isValid: true, value };
  };
}

/**
 * Uppercase sanitizer
 * @returns {Validator} Sanitizer function
 */
function toUpperCase() {
  return (value, context) => {
    if (typeof value === 'string') {
      return { isValid: true, value: value.toUpperCase() };
    }
    return { isValid: true, value };
  };
}

/**
 * Default value provider
 * @param {*} defaultValue - Default value to use
 * @returns {Validator} Default value function
 */
function defaultValue(defaultValue) {
  return (value, context) => {
    const finalValue = (value === undefined || value === null) ? defaultValue : value;
    return { isValid: true, value: finalValue };
  };
}

export {
  ValidationSchema,
  ValidationContext,
  ValidationError,
  // Validators
  required,
  string,
  number,
  boolean,
  email,
  minLength,
  maxLength,
  min,
  max,
  pattern,
  oneOf,
  custom,
  // Sanitizers
  trim,
  toLowerCase,
  toUpperCase,
  defaultValue
};