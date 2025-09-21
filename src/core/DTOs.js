/**
 * Data Transfer Objects (DTOs) for Type Safety
 *
 * Provides structured data transfer objects for request/response handling
 * with built-in validation, transformation, and type safety features.
 * Ensures consistent data structures across API boundaries.
 *
 * @example
 * class UserDTO extends BaseDTO {
 *   static schema = {
 *     id: { type: 'number', required: true },
 *     name: { type: 'string', required: true, minLength: 2 },
 *     email: { type: 'string', required: true, format: 'email' }
 *   };
 * }
 *
 * const userDto = UserDTO.fromObject(userData);
 * const isValid = userDto.validate();
 */

import { ValidationSchema, required, string, number, boolean, email } from './Validation.js';

/**
 * DTO validation options
 * @typedef {Object} DTOOptions
 * @property {boolean} [strict=true] - Strict validation (no unknown properties)
 * @property {boolean} [transform=true] - Apply transformations
 * @property {boolean} [validate=true] - Validate on creation
 * @property {Object} [context] - Validation context
 */

/**
 * Field definition for DTO schema
 * @typedef {Object} FieldDefinition
 * @property {string} type - Field type (string, number, boolean, object, array)
 * @property {boolean} [required=false] - Whether field is required
 * @property {*} [default] - Default value
 * @property {Array<Function>} [validators] - Additional validators
 * @property {Function} [transform] - Transformation function
 * @property {string} [description] - Field description
 * @property {Object} [schema] - Nested schema for objects
 * @property {FieldDefinition} [items] - Item definition for arrays
 */

/**
 * Base DTO class providing common functionality
 */
class BaseDTO {
  /**
   * Schema definition for the DTO
   * Override in subclasses
   * @static
   * @type {Object<string, FieldDefinition>}
   */
  static schema = {};

  /**
   * DTO options
   * @static
   * @type {DTOOptions}
   */
  static options = {
    strict: true,
    transform: true,
    validate: true
  };

  constructor(data = {}, options = {}) {
    this._data = {};
    this._errors = [];
    this._warnings = [];
    this._isValid = null;
    this._options = { ...this.constructor.options, ...options };

    // Initialize with data
    if (data && typeof data === 'object') {
      this._populateFromObject(data);
    }

    // Validate if enabled
    if (this._options.validate) {
      this.validate();
    }
  }

  /**
   * Create DTO from plain object
   * @static
   * @param {Object} data - Data object
   * @param {DTOOptions} [options] - DTO options
   * @returns {BaseDTO} DTO instance
   */
  static fromObject(data, options = {}) {
    return new this(data, options);
  }

  /**
   * Create DTO from JSON string
   * @static
   * @param {string} json - JSON string
   * @param {DTOOptions} [options] - DTO options
   * @returns {BaseDTO} DTO instance
   */
  static fromJSON(json, options = {}) {
    try {
      const data = JSON.parse(json);
      return new this(data, options);
    } catch (error) {
      const dto = new this({}, options);
      dto._errors.push({
        field: '',
        code: 'INVALID_JSON',
        message: 'Invalid JSON format',
        value: json
      });
      dto._isValid = false;
      return dto;
    }
  }

  /**
   * Create multiple DTOs from array
   * @static
   * @param {Array<Object>} dataArray - Array of data objects
   * @param {DTOOptions} [options] - DTO options
   * @returns {Array<BaseDTO>} Array of DTO instances
   */
  static fromArray(dataArray, options = {}) {
    if (!Array.isArray(dataArray)) {
      throw new Error('Expected array input');
    }

    return dataArray.map(data => new this(data, options));
  }

  /**
   * Validate the DTO
   * @param {DTOOptions} [options] - Validation options
   * @returns {boolean} Whether validation passed
   */
  validate(options = {}) {
    const mergedOptions = { ...this._options, ...options };
    this._errors = [];
    this._warnings = [];

    try {
      const schema = this._buildValidationSchema();
      const result = schema.validateSync(this._data, {
        abortEarly: false,
        allowUnknown: !mergedOptions.strict,
        stripUnknown: mergedOptions.strict,
        context: mergedOptions.context
      });

      this._isValid = result.isValid;
      this._errors = result.errors;
      this._warnings = result.warnings;

      if (result.isValid && mergedOptions.transform) {
        this._data = result.data;
      }

      return result.isValid;
    } catch (error) {
      this._errors.push({
        field: '',
        code: 'VALIDATION_ERROR',
        message: error.message,
        value: this._data
      });
      this._isValid = false;
      return false;
    }
  }

  /**
   * Transform data according to schema
   * @returns {BaseDTO} This instance for chaining
   */
  transform() {
    for (const [field, definition] of Object.entries(this.constructor.schema)) {
      if (definition.transform && this._data[field] !== undefined) {
        try {
          this._data[field] = definition.transform(this._data[field]);
        } catch (error) {
          this._warnings.push({
            field,
            message: `Transform failed: ${error.message}`
          });
        }
      }
    }
    return this;
  }

  /**
   * Get field value
   * @param {string} field - Field name
   * @returns {*} Field value
   */
  get(field) {
    return this._data[field];
  }

  /**
   * Set field value
   * @param {string} field - Field name
   * @param {*} value - Field value
   * @returns {BaseDTO} This instance for chaining
   */
  set(field, value) {
    this._data[field] = value;
    this._isValid = null; // Reset validation state
    return this;
  }

  /**
   * Check if field exists
   * @param {string} field - Field name
   * @returns {boolean} Whether field exists
   */
  has(field) {
    return field in this._data;
  }

  /**
   * Remove field
   * @param {string} field - Field name
   * @returns {BaseDTO} This instance for chaining
   */
  remove(field) {
    delete this._data[field];
    this._isValid = null;
    return this;
  }

  /**
   * Get all field names
   * @returns {Array<string>} Field names
   */
  getFields() {
    return Object.keys(this._data);
  }

  /**
   * Check if DTO is valid
   * @returns {boolean|null} Validation status (null if not validated)
   */
  isValid() {
    return this._isValid;
  }

  /**
   * Get validation errors
   * @returns {Array<Object>} Validation errors
   */
  getErrors() {
    return [...this._errors];
  }

  /**
   * Get validation warnings
   * @returns {Array<Object>} Validation warnings
   */
  getWarnings() {
    return [...this._warnings];
  }

  /**
   * Get errors for specific field
   * @param {string} field - Field name
   * @returns {Array<Object>} Field errors
   */
  getFieldErrors(field) {
    return this._errors.filter(error => error.field === field);
  }

  /**
   * Convert to plain object
   * @param {Object} [options={}] - Conversion options
   * @param {boolean} [options.includeUndefined=false] - Include undefined values
   * @param {Array<string>} [options.fields] - Specific fields to include
   * @param {Array<string>} [options.exclude] - Fields to exclude
   * @returns {Object} Plain object representation
   */
  toObject(options = {}) {
    let result = { ...this._data };

    // Include only specific fields
    if (options.fields && Array.isArray(options.fields)) {
      const filtered = {};
      for (const field of options.fields) {
        if (field in result) {
          filtered[field] = result[field];
        }
      }
      result = filtered;
    }

    // Exclude specific fields
    if (options.exclude && Array.isArray(options.exclude)) {
      for (const field of options.exclude) {
        delete result[field];
      }
    }

    // Handle undefined values
    if (!options.includeUndefined) {
      for (const [key, value] of Object.entries(result)) {
        if (value === undefined) {
          delete result[key];
        }
      }
    }

    return result;
  }

  /**
   * Convert to JSON string
   * @param {Object} [options={}] - Conversion options
   * @param {number} [space] - JSON spacing
   * @returns {string} JSON representation
   */
  toJSON(options = {}, space) {
    return JSON.stringify(this.toObject(options), null, space);
  }

  /**
   * Clone the DTO
   * @param {DTOOptions} [options] - Clone options
   * @returns {BaseDTO} Cloned DTO
   */
  clone(options = {}) {
    return new this.constructor(this._data, { ...this._options, ...options });
  }

  /**
   * Merge with another DTO or object
   * @param {BaseDTO|Object} other - Other DTO or object
   * @param {Object} [options={}] - Merge options
   * @param {boolean} [options.overwrite=true] - Overwrite existing fields
   * @returns {BaseDTO} This instance for chaining
   */
  merge(other, options = {}) {
    const otherData = other instanceof BaseDTO ? other.toObject() : other;
    const { overwrite = true } = options;

    for (const [field, value] of Object.entries(otherData)) {
      if (overwrite || !(field in this._data)) {
        this._data[field] = value;
      }
    }

    this._isValid = null; // Reset validation state
    return this;
  }

  /**
   * Get schema information
   * @static
   * @returns {Object} Schema information
   */
  static getSchema() {
    return {
      fields: this.schema,
      options: this.options
    };
  }

  /**
   * Get field definition
   * @static
   * @param {string} field - Field name
   * @returns {FieldDefinition|null} Field definition
   */
  static getFieldDefinition(field) {
    return this.schema[field] || null;
  }

  /**
   * Check if field is required
   * @static
   * @param {string} field - Field name
   * @returns {boolean} Whether field is required
   */
  static isFieldRequired(field) {
    const definition = this.getFieldDefinition(field);
    return definition ? definition.required === true : false;
  }

  /**
   * Populate DTO from object
   * @private
   * @param {Object} data - Data object
   */
  _populateFromObject(data) {
    const schema = this.constructor.schema;

    for (const [field, value] of Object.entries(data)) {
      const definition = schema[field];

      if (definition) {
        // Apply default value if needed
        if (value === undefined && definition.default !== undefined) {
          this._data[field] = typeof definition.default === 'function'
            ? definition.default()
            : definition.default;
        } else {
          this._data[field] = value;
        }
      } else if (!this._options.strict) {
        // Allow unknown fields if not in strict mode
        this._data[field] = value;
      }
    }

    // Set default values for missing required fields
    for (const [field, definition] of Object.entries(schema)) {
      if (!(field in this._data) && definition.default !== undefined) {
        this._data[field] = typeof definition.default === 'function'
          ? definition.default()
          : definition.default;
      }
    }
  }

  /**
   * Build validation schema from DTO schema
   * @private
   * @returns {ValidationSchema} Validation schema
   */
  _buildValidationSchema() {
    const validationSchema = {};

    for (const [field, definition] of Object.entries(this.constructor.schema)) {
      const validators = [];

      // Required validator
      if (definition.required) {
        validators.push(required());
      }

      // Type validators
      switch (definition.type) {
        case 'string':
          validators.push(string());
          break;
        case 'number':
          validators.push(number());
          break;
        case 'boolean':
          validators.push(boolean());
          break;
      }

      // Format validators
      if (definition.format === 'email') {
        validators.push(email());
      }

      // Additional validators
      if (definition.validators && Array.isArray(definition.validators)) {
        validators.push(...definition.validators);
      }

      validationSchema[field] = validators;
    }

    return new ValidationSchema(validationSchema, {
      allowUnknown: !this._options.strict,
      stripUnknown: this._options.strict
    });
  }
}

// ============ COMMON DTOs ============

/**
 * Base Request DTO
 */
class BaseRequestDTO extends BaseDTO {
  static options = {
    strict: true,
    transform: true,
    validate: true
  };
}

/**
 * Base Response DTO
 */
class BaseResponseDTO extends BaseDTO {
  static options = {
    strict: false,
    transform: true,
    validate: false
  };
}

/**
 * Pagination Request DTO
 */
class PaginationRequestDTO extends BaseRequestDTO {
  static schema = {
    page: {
      type: 'number',
      required: false,
      default: 1,
      validators: [
        (value) => ({
          isValid: value >= 1,
          error: 'Page must be greater than 0',
          code: 'INVALID_PAGE'
        })
      ]
    },
    limit: {
      type: 'number',
      required: false,
      default: 10,
      validators: [
        (value) => ({
          isValid: value >= 1 && value <= 100,
          error: 'Limit must be between 1 and 100',
          code: 'INVALID_LIMIT'
        })
      ]
    },
    sortBy: {
      type: 'string',
      required: false
    },
    sortOrder: {
      type: 'string',
      required: false,
      default: 'asc',
      validators: [
        (value) => ({
          isValid: ['asc', 'desc'].includes(value),
          error: 'Sort order must be asc or desc',
          code: 'INVALID_SORT_ORDER'
        })
      ]
    }
  };
}

/**
 * Error Response DTO
 */
class ErrorResponseDTO extends BaseResponseDTO {
  static schema = {
    success: {
      type: 'boolean',
      required: true,
      default: false
    },
    message: {
      type: 'string',
      required: true
    },
    errors: {
      type: 'array',
      required: false,
      default: []
    },
    timestamp: {
      type: 'string',
      required: false,
      default: () => new Date().toISOString()
    },
    requestId: {
      type: 'string',
      required: false
    }
  };
}

/**
 * Success Response DTO
 */
class SuccessResponseDTO extends BaseResponseDTO {
  static schema = {
    success: {
      type: 'boolean',
      required: true,
      default: true
    },
    data: {
      type: 'object',
      required: false
    },
    message: {
      type: 'string',
      required: false
    },
    timestamp: {
      type: 'string',
      required: false,
      default: () => new Date().toISOString()
    },
    requestId: {
      type: 'string',
      required: false
    }
  };
}

// ============ APPLICATION-SPECIFIC DTOs ============

/**
 * Grading Request DTO
 */
class GradingRequestDTO extends BaseRequestDTO {
  static schema = {
    studentText: {
      type: 'string',
      required: true,
      description: 'The student essay text to grade'
    },
    prompt: {
      type: 'string',
      required: false,
      description: 'Custom grading prompt'
    },
    studentName: {
      type: 'string',
      required: false,
      description: 'Student name for personalization'
    },
    classProfile: {
      type: 'string',
      required: false,
      description: 'Class profile ID to use for grading'
    },
    temperature: {
      type: 'number',
      required: false,
      default: 0,
      validators: [
        (value) => ({
          isValid: value >= 0 && value <= 1,
          error: 'Temperature must be between 0 and 1',
          code: 'INVALID_TEMPERATURE'
        })
      ],
      description: 'AI temperature setting for grading randomness'
    }
  };
}

/**
 * Batch Grading Request DTO
 */
class BatchGradingRequestDTO extends BaseRequestDTO {
  static schema = {
    essays: {
      type: 'array',
      required: true,
      description: 'Array of essays to grade'
    },
    prompt: {
      type: 'string',
      required: false,
      description: 'Custom grading prompt'
    },
    classProfile: {
      type: 'string',
      required: false,
      description: 'Class profile ID to use for grading'
    },
    temperature: {
      type: 'number',
      required: false,
      default: 0,
      validators: [
        (value) => ({
          isValid: value >= 0 && value <= 1,
          error: 'Temperature must be between 0 and 1',
          code: 'INVALID_TEMPERATURE'
        })
      ],
      description: 'AI temperature setting for grading randomness'
    }
  };
}

/**
 * Essay DTO
 */
class EssayDTO extends BaseDTO {
  static schema = {
    studentName: {
      type: 'string',
      required: true,
      description: 'Student name'
    },
    studentText: {
      type: 'string',
      required: true,
      description: 'Essay content'
    }
  };
}

/**
 * Grading Result DTO
 */
class GradingResultDTO extends BaseResponseDTO {
  static schema = {
    studentName: {
      type: 'string',
      required: false
    },
    score: {
      type: 'number',
      required: false
    },
    feedback: {
      type: 'string',
      required: false
    },
    rubricBreakdown: {
      type: 'object',
      required: false
    },
    gradingTime: {
      type: 'number',
      required: false,
      description: 'Time taken to grade in milliseconds'
    },
    timestamp: {
      type: 'string',
      required: false,
      default: () => new Date().toISOString()
    }
  };
}

/**
 * Profile DTO
 */
class ProfileDTO extends BaseDTO {
  static schema = {
    id: {
      type: 'string',
      required: true
    },
    name: {
      type: 'string',
      required: true
    },
    prompt: {
      type: 'string',
      required: true
    },
    temperature: {
      type: 'number',
      required: false,
      default: 0,
      validators: [
        (value) => ({
          isValid: value >= 0 && value <= 1,
          error: 'Temperature must be between 0 and 1',
          code: 'INVALID_TEMPERATURE'
        })
      ]
    },
    rubric: {
      type: 'object',
      required: false
    },
    isActive: {
      type: 'boolean',
      required: false,
      default: true
    }
  };
}

/**
 * DTO Factory for creating DTOs
 */
class DTOFactory {
  static dtos = new Map();

  /**
   * Register a DTO class
   * @param {string} name - DTO name
   * @param {Function} DTOClass - DTO class
   */
  static register(name, DTOClass) {
    this.dtos.set(name, DTOClass);
  }

  /**
   * Create DTO instance
   * @param {string} name - DTO name
   * @param {Object} data - Data to populate DTO
   * @param {DTOOptions} [options] - DTO options
   * @returns {BaseDTO} DTO instance
   */
  static create(name, data, options = {}) {
    const DTOClass = this.dtos.get(name);
    if (!DTOClass) {
      throw new Error(`DTO '${name}' is not registered`);
    }

    return new DTOClass(data, options);
  }

  /**
   * Get registered DTO names
   * @returns {Array<string>} DTO names
   */
  static getRegisteredDTOs() {
    return Array.from(this.dtos.keys());
  }
}

// Register common DTOs
DTOFactory.register('PaginationRequest', PaginationRequestDTO);
DTOFactory.register('ErrorResponse', ErrorResponseDTO);
DTOFactory.register('SuccessResponse', SuccessResponseDTO);
DTOFactory.register('GradingRequest', GradingRequestDTO);
DTOFactory.register('BatchGradingRequest', BatchGradingRequestDTO);
DTOFactory.register('Essay', EssayDTO);
DTOFactory.register('GradingResult', GradingResultDTO);
DTOFactory.register('Profile', ProfileDTO);

export {
  BaseDTO,
  BaseRequestDTO,
  BaseResponseDTO,
  PaginationRequestDTO,
  ErrorResponseDTO,
  SuccessResponseDTO,
  GradingRequestDTO,
  BatchGradingRequestDTO,
  EssayDTO,
  GradingResultDTO,
  ProfileDTO,
  DTOFactory
};