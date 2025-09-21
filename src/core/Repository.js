/**
 * Repository Pattern Implementation
 *
 * Provides an abstraction layer over data access operations. This pattern
 * encapsulates the logic needed to access data sources, centralizing common
 * data access functionality, and providing better maintainability.
 *
 * @example
 * class UserRepository extends BaseRepository {
 *   async findByEmail(email) {
 *     return this.findFirst({ where: { email } });
 *   }
 * }
 */

/**
 * Query options for repository operations
 * @typedef {Object} QueryOptions
 * @property {Object} [where] - WHERE conditions
 * @property {Object} [orderBy] - ORDER BY conditions
 * @property {number} [take] - LIMIT/TAKE number of records
 * @property {number} [skip] - SKIP/OFFSET number of records
 * @property {Object} [include] - Include related data
 * @property {Object} [select] - Select specific fields
 */

/**
 * Repository operation result
 * @typedef {Object} RepositoryResult
 * @property {boolean} success - Whether operation succeeded
 * @property {*} [data] - Result data
 * @property {Error} [error] - Error if operation failed
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * Base Repository class providing common data access patterns
 *
 * This abstract base class provides a standard interface for data access
 * operations and can be extended for specific entity repositories.
 */
class BaseRepository {
  /**
   * Create a new repository
   *
   * @param {Object} dataSource - Data source (e.g., Prisma client, database connection)
   * @param {string} modelName - Name of the model/table this repository manages
   * @param {Object} [options={}] - Repository options
   * @param {Object} [options.logger] - Logger instance
   * @param {boolean} [options.enableCaching=false] - Enable query caching
   * @param {number} [options.cacheTTL=300] - Cache TTL in seconds
   */
  constructor(dataSource, modelName, options = {}) {
    if (!dataSource) {
      throw new Error('Data source is required');
    }
    if (!modelName || typeof modelName !== 'string') {
      throw new Error('Model name must be a non-empty string');
    }

    this.dataSource = dataSource;
    this.modelName = modelName;
    this.model = dataSource[modelName];
    this.logger = options.logger || console;
    this.enableCaching = options.enableCaching || false;
    this.cacheTTL = options.cacheTTL || 300; // 5 minutes default
    this._cache = new Map();

    if (!this.model) {
      throw new Error(`Model '${modelName}' not found in data source`);
    }

    this._validateDataSource();
  }

  /**
   * Create a new record
   *
   * @param {Object} data - Data to create
   * @param {Object} [options={}] - Creation options
   * @returns {Promise<RepositoryResult>} Creation result
   *
   * @example
   * const result = await userRepo.create({
   *   name: 'John Doe',
   *   email: 'john@example.com'
   * });
   */
  async create(data, options = {}) {
    try {
      this._logOperation('create', { data, options });

      const result = await this.model.create({
        data,
        ...options
      });

      this._invalidateCache();

      return {
        success: true,
        data: result,
        metadata: { operation: 'create', timestamp: new Date() }
      };
    } catch (error) {
      this.logger.error(`[Repository:${this.modelName}] Create failed:`, error);
      return {
        success: false,
        error,
        metadata: { operation: 'create', timestamp: new Date() }
      };
    }
  }

  /**
   * Create multiple records
   *
   * @param {Array<Object>} data - Array of data objects to create
   * @param {Object} [options={}] - Creation options
   * @returns {Promise<RepositoryResult>} Creation result
   */
  async createMany(data, options = {}) {
    try {
      this._logOperation('createMany', { count: data.length, options });

      const result = await this.model.createMany({
        data,
        ...options
      });

      this._invalidateCache();

      return {
        success: true,
        data: result,
        metadata: { operation: 'createMany', count: data.length, timestamp: new Date() }
      };
    } catch (error) {
      this.logger.error(`[Repository:${this.modelName}] CreateMany failed:`, error);
      return {
        success: false,
        error,
        metadata: { operation: 'createMany', timestamp: new Date() }
      };
    }
  }

  /**
   * Find a single record by ID
   *
   * @param {string|number} id - Record ID
   * @param {Object} [options={}] - Query options
   * @returns {Promise<RepositoryResult>} Find result
   */
  async findById(id, options = {}) {
    try {
      const cacheKey = this._getCacheKey('findById', { id, options });
      const cached = this._getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      this._logOperation('findById', { id, options });

      const result = await this.model.findUnique({
        where: { id },
        ...options
      });

      const repositoryResult = {
        success: true,
        data: result,
        metadata: { operation: 'findById', id, timestamp: new Date() }
      };

      this._setCache(cacheKey, repositoryResult);
      return repositoryResult;
    } catch (error) {
      this.logger.error(`[Repository:${this.modelName}] FindById failed:`, error);
      return {
        success: false,
        error,
        metadata: { operation: 'findById', id, timestamp: new Date() }
      };
    }
  }

  /**
   * Find the first record matching criteria
   *
   * @param {QueryOptions} [queryOptions={}] - Query options
   * @returns {Promise<RepositoryResult>} Find result
   */
  async findFirst(queryOptions = {}) {
    try {
      const cacheKey = this._getCacheKey('findFirst', queryOptions);
      const cached = this._getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      this._logOperation('findFirst', queryOptions);

      const result = await this.model.findFirst(queryOptions);

      const repositoryResult = {
        success: true,
        data: result,
        metadata: { operation: 'findFirst', timestamp: new Date() }
      };

      this._setCache(cacheKey, repositoryResult);
      return repositoryResult;
    } catch (error) {
      this.logger.error(`[Repository:${this.modelName}] FindFirst failed:`, error);
      return {
        success: false,
        error,
        metadata: { operation: 'findFirst', timestamp: new Date() }
      };
    }
  }

  /**
   * Find multiple records matching criteria
   *
   * @param {QueryOptions} [queryOptions={}] - Query options
   * @returns {Promise<RepositoryResult>} Find result
   */
  async findMany(queryOptions = {}) {
    try {
      const cacheKey = this._getCacheKey('findMany', queryOptions);
      const cached = this._getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      this._logOperation('findMany', queryOptions);

      const result = await this.model.findMany(queryOptions);

      const repositoryResult = {
        success: true,
        data: result,
        metadata: {
          operation: 'findMany',
          count: result.length,
          timestamp: new Date()
        }
      };

      this._setCache(cacheKey, repositoryResult);
      return repositoryResult;
    } catch (error) {
      this.logger.error(`[Repository:${this.modelName}] FindMany failed:`, error);
      return {
        success: false,
        error,
        metadata: { operation: 'findMany', timestamp: new Date() }
      };
    }
  }

  /**
   * Update a record by ID
   *
   * @param {string|number} id - Record ID
   * @param {Object} data - Data to update
   * @param {Object} [options={}] - Update options
   * @returns {Promise<RepositoryResult>} Update result
   */
  async updateById(id, data, options = {}) {
    try {
      this._logOperation('updateById', { id, data, options });

      const result = await this.model.update({
        where: { id },
        data,
        ...options
      });

      this._invalidateCache();

      return {
        success: true,
        data: result,
        metadata: { operation: 'updateById', id, timestamp: new Date() }
      };
    } catch (error) {
      this.logger.error(`[Repository:${this.modelName}] UpdateById failed:`, error);
      return {
        success: false,
        error,
        metadata: { operation: 'updateById', id, timestamp: new Date() }
      };
    }
  }

  /**
   * Update multiple records matching criteria
   *
   * @param {Object} where - WHERE conditions
   * @param {Object} data - Data to update
   * @param {Object} [options={}] - Update options
   * @returns {Promise<RepositoryResult>} Update result
   */
  async updateMany(where, data, options = {}) {
    try {
      this._logOperation('updateMany', { where, data, options });

      const result = await this.model.updateMany({
        where,
        data,
        ...options
      });

      this._invalidateCache();

      return {
        success: true,
        data: result,
        metadata: { operation: 'updateMany', affected: result.count, timestamp: new Date() }
      };
    } catch (error) {
      this.logger.error(`[Repository:${this.modelName}] UpdateMany failed:`, error);
      return {
        success: false,
        error,
        metadata: { operation: 'updateMany', timestamp: new Date() }
      };
    }
  }

  /**
   * Delete a record by ID
   *
   * @param {string|number} id - Record ID
   * @param {Object} [options={}] - Delete options
   * @returns {Promise<RepositoryResult>} Delete result
   */
  async deleteById(id, options = {}) {
    try {
      this._logOperation('deleteById', { id, options });

      const result = await this.model.delete({
        where: { id },
        ...options
      });

      this._invalidateCache();

      return {
        success: true,
        data: result,
        metadata: { operation: 'deleteById', id, timestamp: new Date() }
      };
    } catch (error) {
      this.logger.error(`[Repository:${this.modelName}] DeleteById failed:`, error);
      return {
        success: false,
        error,
        metadata: { operation: 'deleteById', id, timestamp: new Date() }
      };
    }
  }

  /**
   * Delete multiple records matching criteria
   *
   * @param {Object} where - WHERE conditions
   * @param {Object} [options={}] - Delete options
   * @returns {Promise<RepositoryResult>} Delete result
   */
  async deleteMany(where, options = {}) {
    try {
      this._logOperation('deleteMany', { where, options });

      const result = await this.model.deleteMany({
        where,
        ...options
      });

      this._invalidateCache();

      return {
        success: true,
        data: result,
        metadata: { operation: 'deleteMany', affected: result.count, timestamp: new Date() }
      };
    } catch (error) {
      this.logger.error(`[Repository:${this.modelName}] DeleteMany failed:`, error);
      return {
        success: false,
        error,
        metadata: { operation: 'deleteMany', timestamp: new Date() }
      };
    }
  }

  /**
   * Count records matching criteria
   *
   * @param {Object} [where={}] - WHERE conditions
   * @returns {Promise<RepositoryResult>} Count result
   */
  async count(where = {}) {
    try {
      const cacheKey = this._getCacheKey('count', { where });
      const cached = this._getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      this._logOperation('count', { where });

      const result = await this.model.count({ where });

      const repositoryResult = {
        success: true,
        data: result,
        metadata: { operation: 'count', timestamp: new Date() }
      };

      this._setCache(cacheKey, repositoryResult);
      return repositoryResult;
    } catch (error) {
      this.logger.error(`[Repository:${this.modelName}] Count failed:`, error);
      return {
        success: false,
        error,
        metadata: { operation: 'count', timestamp: new Date() }
      };
    }
  }

  /**
   * Check if a record exists
   *
   * @param {Object} where - WHERE conditions
   * @returns {Promise<RepositoryResult>} Exists result
   */
  async exists(where) {
    try {
      const result = await this.findFirst({ where, select: { id: true } });

      return {
        success: true,
        data: result.data !== null,
        metadata: { operation: 'exists', timestamp: new Date() }
      };
    } catch (error) {
      this.logger.error(`[Repository:${this.modelName}] Exists failed:`, error);
      return {
        success: false,
        error,
        metadata: { operation: 'exists', timestamp: new Date() }
      };
    }
  }

  /**
   * Execute a raw query
   *
   * @param {string} query - Raw SQL query
   * @param {Array} [params=[]] - Query parameters
   * @returns {Promise<RepositoryResult>} Query result
   */
  async raw(query, params = []) {
    try {
      this._logOperation('raw', { query: query.substring(0, 100), paramCount: params.length });

      const result = await this.dataSource.$queryRaw`${query}`;

      return {
        success: true,
        data: result,
        metadata: { operation: 'raw', timestamp: new Date() }
      };
    } catch (error) {
      this.logger.error(`[Repository:${this.modelName}] Raw query failed:`, error);
      return {
        success: false,
        error,
        metadata: { operation: 'raw', timestamp: new Date() }
      };
    }
  }

  /**
   * Execute a transaction
   *
   * @param {Function} callback - Transaction callback function
   * @returns {Promise<RepositoryResult>} Transaction result
   */
  async transaction(callback) {
    try {
      this._logOperation('transaction', {});

      const result = await this.dataSource.$transaction(async (tx) => {
        // Create a new repository instance with the transaction client
        const txRepo = new this.constructor(tx, this.modelName);
        return await callback(txRepo);
      });

      this._invalidateCache();

      return {
        success: true,
        data: result,
        metadata: { operation: 'transaction', timestamp: new Date() }
      };
    } catch (error) {
      this.logger.error(`[Repository:${this.modelName}] Transaction failed:`, error);
      return {
        success: false,
        error,
        metadata: { operation: 'transaction', timestamp: new Date() }
      };
    }
  }

  /**
   * Clear repository cache
   */
  clearCache() {
    this._cache.clear();
    this.logger.debug(`[Repository:${this.modelName}] Cache cleared`);
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this._cache.size,
      enabled: this.enableCaching,
      ttl: this.cacheTTL
    };
  }

  /**
   * Validate the data source has required methods
   *
   * @private
   */
  _validateDataSource() {
    const requiredMethods = ['$queryRaw', '$transaction'];
    for (const method of requiredMethods) {
      if (typeof this.dataSource[method] !== 'function') {
        console.warn(`[Repository:${this.modelName}] Data source missing method: ${method}`);
      }
    }
  }

  /**
   * Log repository operation
   *
   * @private
   * @param {string} operation - Operation name
   * @param {Object} details - Operation details
   */
  _logOperation(operation, details) {
    if (this.logger.debug) {
      this.logger.debug(`[Repository:${this.modelName}] ${operation}`, details);
    }
  }

  /**
   * Generate cache key for operation
   *
   * @private
   * @param {string} operation - Operation name
   * @param {Object} params - Operation parameters
   * @returns {string} Cache key
   */
  _getCacheKey(operation, params) {
    return `${this.modelName}:${operation}:${JSON.stringify(params)}`;
  }

  /**
   * Get item from cache
   *
   * @private
   * @param {string} key - Cache key
   * @returns {*} Cached item or null
   */
  _getFromCache(key) {
    if (!this.enableCaching) {
      return null;
    }

    const cached = this._cache.get(key);
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() - cached.timestamp > this.cacheTTL * 1000) {
      this._cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set item in cache
   *
   * @private
   * @param {string} key - Cache key
   * @param {*} data - Data to cache
   */
  _setCache(key, data) {
    if (!this.enableCaching) {
      return;
    }

    this._cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Invalidate all cache entries
   *
   * @private
   */
  _invalidateCache() {
    if (this.enableCaching) {
      this._cache.clear();
    }
  }
}

/**
 * Repository factory for creating typed repositories
 */
class RepositoryFactory {
  constructor(dataSource, options = {}) {
    this.dataSource = dataSource;
    this.options = options;
    this._repositories = new Map();
  }

  /**
   * Create or get a repository for a model
   *
   * @param {string} modelName - Model name
   * @param {Function} [RepositoryClass=BaseRepository] - Repository class to use
   * @returns {BaseRepository} Repository instance
   */
  getRepository(modelName, RepositoryClass = BaseRepository) {
    const key = `${modelName}:${RepositoryClass.name}`;

    if (!this._repositories.has(key)) {
      const repository = new RepositoryClass(this.dataSource, modelName, this.options);
      this._repositories.set(key, repository);
    }

    return this._repositories.get(key);
  }

  /**
   * Register a custom repository class
   *
   * @param {string} modelName - Model name
   * @param {Function} RepositoryClass - Repository class
   * @returns {BaseRepository} Repository instance
   */
  registerRepository(modelName, RepositoryClass) {
    return this.getRepository(modelName, RepositoryClass);
  }

  /**
   * Clear all cached repositories
   */
  clearRepositories() {
    this._repositories.clear();
  }
}

export {
  BaseRepository,
  RepositoryFactory
};