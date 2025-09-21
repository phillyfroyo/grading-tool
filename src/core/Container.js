/**
 * Dependency Injection Container
 *
 * A lightweight dependency injection container that manages service instances
 * and their dependencies. Supports singleton and transient lifetimes, automatic
 * dependency resolution, and service registration with factory functions.
 *
 * @example
 * const container = new Container();
 * container.register('userRepository', UserRepository, { lifetime: 'singleton' });
 * container.register('userService', UserService, {
 *   dependencies: ['userRepository'],
 *   lifetime: 'transient'
 * });
 * const userService = container.resolve('userService');
 */

/**
 * Service lifetime enumeration
 */
const SERVICE_LIFETIME = {
  SINGLETON: 'singleton',
  TRANSIENT: 'transient',
  SCOPED: 'scoped'
};

/**
 * Service registration metadata
 * @typedef {Object} ServiceRegistration
 * @property {Function|*} implementation - Service constructor or factory function
 * @property {Array<string>} dependencies - Array of dependency service names
 * @property {string} lifetime - Service lifetime (singleton, transient, scoped)
 * @property {*} instance - Cached instance for singleton services
 * @property {boolean} isFactory - Whether implementation is a factory function
 */

class Container {
  constructor() {
    /** @type {Map<string, ServiceRegistration>} */
    this._services = new Map();
    /** @type {Map<string, *>} */
    this._singletonInstances = new Map();
    /** @type {Set<string>} */
    this._resolutionStack = new Set();
    this._isBuilt = false;
  }

  /**
   * Register a service with the container
   *
   * @param {string} name - Service name
   * @param {Function|*} implementation - Service constructor, class, or factory function
   * @param {Object} options - Registration options
   * @param {Array<string>} [options.dependencies=[]] - Service dependencies
   * @param {string} [options.lifetime='singleton'] - Service lifetime
   * @param {boolean} [options.isFactory=false] - Whether implementation is a factory function
   * @returns {Container} This container for method chaining
   *
   * @example
   * container.register('logger', Logger);
   * container.register('userService', UserService, {
   *   dependencies: ['userRepository', 'logger'],
   *   lifetime: 'transient'
   * });
   */
  register(name, implementation, options = {}) {
    if (this._isBuilt) {
      throw new Error('Cannot register services after container is built');
    }

    if (!name || typeof name !== 'string') {
      throw new Error('Service name must be a non-empty string');
    }

    if (!implementation) {
      throw new Error('Service implementation is required');
    }

    const {
      dependencies = [],
      lifetime = SERVICE_LIFETIME.SINGLETON,
      isFactory = false
    } = options;

    // Validate lifetime
    if (!Object.values(SERVICE_LIFETIME).includes(lifetime)) {
      throw new Error(`Invalid service lifetime: ${lifetime}`);
    }

    // Validate dependencies
    if (!Array.isArray(dependencies)) {
      throw new Error('Dependencies must be an array');
    }

    this._services.set(name, {
      implementation,
      dependencies,
      lifetime,
      instance: null,
      isFactory
    });

    console.log(`[DI] Registered service: ${name} (${lifetime})`);
    return this;
  }

  /**
   * Register a singleton service
   *
   * @param {string} name - Service name
   * @param {Function|*} implementation - Service implementation
   * @param {Array<string>} [dependencies=[]] - Service dependencies
   * @returns {Container} This container for method chaining
   */
  registerSingleton(name, implementation, dependencies = []) {
    return this.register(name, implementation, {
      dependencies,
      lifetime: SERVICE_LIFETIME.SINGLETON
    });
  }

  /**
   * Register a transient service
   *
   * @param {string} name - Service name
   * @param {Function|*} implementation - Service implementation
   * @param {Array<string>} [dependencies=[]] - Service dependencies
   * @returns {Container} This container for method chaining
   */
  registerTransient(name, implementation, dependencies = []) {
    return this.register(name, implementation, {
      dependencies,
      lifetime: SERVICE_LIFETIME.TRANSIENT
    });
  }

  /**
   * Register a factory function
   *
   * @param {string} name - Service name
   * @param {Function} factory - Factory function that returns service instance
   * @param {Object} options - Registration options
   * @returns {Container} This container for method chaining
   */
  registerFactory(name, factory, options = {}) {
    return this.register(name, factory, {
      ...options,
      isFactory: true
    });
  }

  /**
   * Register an existing instance
   *
   * @param {string} name - Service name
   * @param {*} instance - Service instance
   * @returns {Container} This container for method chaining
   */
  registerInstance(name, instance) {
    this._singletonInstances.set(name, instance);
    return this.register(name, () => instance, {
      lifetime: SERVICE_LIFETIME.SINGLETON,
      isFactory: true
    });
  }

  /**
   * Build the container and validate all registrations
   * This should be called after all services are registered
   *
   * @returns {Container} This container for method chaining
   */
  build() {
    console.log('[DI] Building container...');

    // Validate all service dependencies
    for (const [serviceName, registration] of this._services) {
      this._validateDependencies(serviceName, registration.dependencies);
    }

    this._isBuilt = true;
    console.log(`[DI] Container built successfully with ${this._services.size} services`);
    return this;
  }

  /**
   * Resolve a service by name
   *
   * @param {string} name - Service name to resolve
   * @returns {*} The resolved service instance
   *
   * @example
   * const userService = container.resolve('userService');
   */
  resolve(name) {
    if (!this._isBuilt) {
      throw new Error('Container must be built before resolving services');
    }

    if (!name || typeof name !== 'string') {
      throw new Error('Service name must be a non-empty string');
    }

    // Check for circular dependencies
    if (this._resolutionStack.has(name)) {
      const stack = Array.from(this._resolutionStack).join(' -> ');
      throw new Error(`Circular dependency detected: ${stack} -> ${name}`);
    }

    const registration = this._services.get(name);
    if (!registration) {
      throw new Error(`Service '${name}' is not registered`);
    }

    // Check if we have a cached singleton instance
    if (registration.lifetime === SERVICE_LIFETIME.SINGLETON) {
      const cachedInstance = this._singletonInstances.get(name);
      if (cachedInstance) {
        return cachedInstance;
      }
    }

    // Add to resolution stack for circular dependency detection
    this._resolutionStack.add(name);

    try {
      // Resolve dependencies
      const dependencies = registration.dependencies.map(dep => this.resolve(dep));

      // Create instance
      let instance;
      if (registration.isFactory) {
        // Factory function
        instance = registration.implementation(...dependencies);
      } else if (typeof registration.implementation === 'function') {
        // Constructor function
        instance = new registration.implementation(...dependencies);
      } else {
        // Direct instance
        instance = registration.implementation;
      }

      // Cache singleton instances
      if (registration.lifetime === SERVICE_LIFETIME.SINGLETON) {
        this._singletonInstances.set(name, instance);
      }

      return instance;
    } finally {
      // Remove from resolution stack
      this._resolutionStack.delete(name);
    }
  }

  /**
   * Check if a service is registered
   *
   * @param {string} name - Service name
   * @returns {boolean} True if service is registered
   */
  hasService(name) {
    return this._services.has(name);
  }

  /**
   * Get all registered service names
   *
   * @returns {string[]} Array of service names
   */
  getServiceNames() {
    return Array.from(this._services.keys());
  }

  /**
   * Get service registration information
   *
   * @param {string} name - Service name
   * @returns {Object|null} Service registration info or null if not found
   */
  getServiceInfo(name) {
    const registration = this._services.get(name);
    if (!registration) {
      return null;
    }

    return {
      name,
      dependencies: registration.dependencies,
      lifetime: registration.lifetime,
      isFactory: registration.isFactory,
      hasInstance: this._singletonInstances.has(name)
    };
  }

  /**
   * Create a child container that inherits services from this container
   *
   * @returns {Container} New child container
   */
  createChild() {
    const child = new Container();

    // Copy service registrations
    for (const [name, registration] of this._services) {
      child._services.set(name, { ...registration });
    }

    // Copy singleton instances
    for (const [name, instance] of this._singletonInstances) {
      child._singletonInstances.set(name, instance);
    }

    return child;
  }

  /**
   * Dispose of the container and clean up resources
   */
  dispose() {
    // Call dispose method on singleton instances that have it
    for (const [name, instance] of this._singletonInstances) {
      if (instance && typeof instance.dispose === 'function') {
        try {
          instance.dispose();
          console.log(`[DI] Disposed service: ${name}`);
        } catch (error) {
          console.error(`[DI] Error disposing service ${name}:`, error);
        }
      }
    }

    this._services.clear();
    this._singletonInstances.clear();
    this._resolutionStack.clear();
    this._isBuilt = false;

    console.log('[DI] Container disposed');
  }

  /**
   * Validate service dependencies
   *
   * @private
   * @param {string} serviceName - Service name
   * @param {Array<string>} dependencies - Dependencies to validate
   */
  _validateDependencies(serviceName, dependencies) {
    for (const dependency of dependencies) {
      if (!this._services.has(dependency)) {
        throw new Error(`Service '${serviceName}' depends on unregistered service '${dependency}'`);
      }
    }

    // Check for circular dependencies using DFS
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (service) => {
      if (recursionStack.has(service)) {
        return true;
      }
      if (visited.has(service)) {
        return false;
      }

      visited.add(service);
      recursionStack.add(service);

      const registration = this._services.get(service);
      if (registration) {
        for (const dep of registration.dependencies) {
          if (hasCycle(dep)) {
            return true;
          }
        }
      }

      recursionStack.delete(service);
      return false;
    };

    if (hasCycle(serviceName)) {
      throw new Error(`Circular dependency detected starting from service '${serviceName}'`);
    }
  }
}

/**
 * Global container instance
 */
let globalContainer = null;

/**
 * Get or create the global container instance
 *
 * @returns {Container} Global container
 */
function getGlobalContainer() {
  if (!globalContainer) {
    globalContainer = new Container();
  }
  return globalContainer;
}

/**
 * Set the global container instance
 *
 * @param {Container} container - Container to set as global
 */
function setGlobalContainer(container) {
  if (!(container instanceof Container)) {
    throw new Error('Global container must be an instance of Container');
  }
  globalContainer = container;
}

/**
 * Resolve a service from the global container
 *
 * @param {string} name - Service name
 * @returns {*} Resolved service
 */
function resolve(name) {
  return getGlobalContainer().resolve(name);
}

export {
  Container,
  SERVICE_LIFETIME,
  getGlobalContainer,
  setGlobalContainer,
  resolve
};