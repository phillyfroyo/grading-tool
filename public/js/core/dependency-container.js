/**
 * Dependency Injection Container
 * Manages module dependencies and reduces tight coupling
 */

import { createLogger } from './logger.js';

const logger = createLogger('Core:DependencyContainer');

class DependencyContainer {
    constructor() {
        this.services = new Map();
        this.factories = new Map();
        this.singletons = new Map();
        this.instances = new Map();
        this.dependencies = new Map();
    }

    /**
     * Register a service factory
     * @param {string} name - Service name
     * @param {Function} factory - Factory function
     * @param {Array} deps - Dependencies
     * @param {Object} options - Registration options
     */
    register(name, factory, deps = [], options = {}) {
        if (this.factories.has(name)) {
            logger.warn(`Service ${name} is already registered. Overriding.`);
        }

        this.factories.set(name, factory);
        this.dependencies.set(name, deps);

        if (options.singleton !== false) {
            this.singletons.set(name, true);
        }

        logger.debug(`Registered service: ${name} with dependencies: [${deps.join(', ')}]`);
    }

    /**
     * Register a singleton instance
     * @param {string} name - Service name
     * @param {*} instance - Service instance
     */
    registerInstance(name, instance) {
        this.instances.set(name, instance);
        this.singletons.set(name, true);
        logger.debug(`Registered instance: ${name}`);
    }

    /**
     * Get a service instance
     * @param {string} name - Service name
     * @returns {*} Service instance
     */
    get(name) {
        // Check for existing instance
        if (this.instances.has(name)) {
            return this.instances.get(name);
        }

        // Check if it's a registered service
        if (!this.factories.has(name)) {
            // Try to get from global scope as fallback
            const globalService = this.getGlobalService(name);
            if (globalService) {
                logger.debug(`Retrieved global service: ${name}`);
                return globalService;
            }

            throw new Error(`Service not found: ${name}`);
        }

        // Create instance
        const instance = this.createInstance(name);

        // Store if singleton
        if (this.singletons.get(name)) {
            this.instances.set(name, instance);
        }

        return instance;
    }

    /**
     * Create a service instance
     * @param {string} name - Service name
     * @returns {*} Service instance
     */
    createInstance(name) {
        const factory = this.factories.get(name);
        const deps = this.dependencies.get(name) || [];

        // Resolve dependencies
        const resolvedDeps = deps.map(dep => {
            try {
                return this.get(dep);
            } catch (error) {
                logger.error(`Failed to resolve dependency ${dep} for ${name}:`, error);
                return null;
            }
        });

        // Create instance
        try {
            const instance = factory(...resolvedDeps);
            logger.debug(`Created instance: ${name}`);
            return instance;
        } catch (error) {
            logger.error(`Failed to create instance of ${name}:`, error);
            throw error;
        }
    }

    /**
     * Get service from global scope
     * @param {string} name - Service name
     * @returns {*} Global service or null
     */
    getGlobalService(name) {
        const globalMappings = {
            'eventBus': () => window.eventBus,
            'modalManager': () => window.ModalManager,
            'logger': () => window.Logger,
            'highlightingModule': () => window.HighlightingModule,
            'textSelectionModule': () => window.TextSelectionModule,
            'categorySelectionModule': () => window.CategorySelectionModule,
            'essayEditingModule': () => window.EssayEditingModule,
            'gradingDisplayModule': () => window.GradingDisplayModule,
            'uiInteractionsModule': () => window.UIInteractionsModule,
            'profilesModule': () => window.ProfilesModule,
            'pdfExportModule': () => window.PDFExportModule,
            'essayManagementModule': () => window.EssayManagementModule,
            'batchProcessingModule': () => window.BatchProcessingModule,
            'displayUtilsModule': () => window.DisplayUtilsModule
        };

        const mapper = globalMappings[name];
        if (mapper) {
            return mapper();
        }

        // Try direct window access
        return window[name] || null;
    }

    /**
     * Check if a service is registered
     * @param {string} name - Service name
     * @returns {boolean} True if registered
     */
    has(name) {
        return this.factories.has(name) ||
               this.instances.has(name) ||
               this.getGlobalService(name) !== null;
    }

    /**
     * Remove a service
     * @param {string} name - Service name
     */
    remove(name) {
        this.factories.delete(name);
        this.instances.delete(name);
        this.dependencies.delete(name);
        this.singletons.delete(name);
        logger.debug(`Removed service: ${name}`);
    }

    /**
     * Clear all services
     */
    clear() {
        this.factories.clear();
        this.instances.clear();
        this.dependencies.clear();
        this.singletons.clear();
        logger.info('Cleared all services');
    }

    /**
     * Get all registered service names
     * @returns {Array} Array of service names
     */
    getServiceNames() {
        const registered = Array.from(this.factories.keys());
        const instances = Array.from(this.instances.keys());
        return [...new Set([...registered, ...instances])];
    }

    /**
     * Get dependency graph
     * @returns {Object} Dependency graph
     */
    getDependencyGraph() {
        const graph = {};
        this.dependencies.forEach((deps, name) => {
            graph[name] = deps;
        });
        return graph;
    }

    /**
     * Validate all dependencies can be resolved
     * @returns {Object} Validation result
     */
    validateDependencies() {
        const result = {
            valid: true,
            missing: [],
            circular: []
        };

        // Check for missing dependencies
        this.dependencies.forEach((deps, name) => {
            deps.forEach(dep => {
                if (!this.has(dep)) {
                    result.valid = false;
                    result.missing.push({ service: name, dependency: dep });
                }
            });
        });

        // Check for circular dependencies (simple detection)
        const visited = new Set();
        const visiting = new Set();

        const checkCircular = (name) => {
            if (visiting.has(name)) {
                result.valid = false;
                result.circular.push(name);
                return;
            }
            if (visited.has(name)) {
                return;
            }

            visiting.add(name);
            const deps = this.dependencies.get(name) || [];
            deps.forEach(dep => checkCircular(dep));
            visiting.delete(name);
            visited.add(name);
        };

        this.dependencies.forEach((deps, name) => {
            checkCircular(name);
        });

        return result;
    }

    /**
     * Initialize all registered services
     * @returns {Promise} Initialization promise
     */
    async initializeAll() {
        logger.info('Initializing all services...');

        const serviceNames = this.getServiceNames();
        const initialized = new Set();
        const failed = [];

        // Initialize services with dependency order
        const initializeService = async (name) => {
            if (initialized.has(name)) {
                return;
            }

            const deps = this.dependencies.get(name) || [];

            // Initialize dependencies first
            for (const dep of deps) {
                if (!initialized.has(dep)) {
                    await initializeService(dep);
                }
            }

            try {
                const service = this.get(name);
                if (service && typeof service.initialize === 'function') {
                    await service.initialize();
                }
                initialized.add(name);
                logger.debug(`Initialized service: ${name}`);
            } catch (error) {
                logger.error(`Failed to initialize service ${name}:`, error);
                failed.push({ name, error });
            }
        };

        // Initialize all services
        for (const name of serviceNames) {
            await initializeService(name);
        }

        logger.info(`Initialization complete. Success: ${initialized.size}, Failed: ${failed.length}`);

        if (failed.length > 0) {
            logger.warn('Failed services:', failed.map(f => f.name));
        }

        return { initialized: Array.from(initialized), failed };
    }

    /**
     * Create a scoped container
     * @returns {DependencyContainer} Scoped container
     */
    createScope() {
        const scope = new DependencyContainer();

        // Copy factories and dependencies
        this.factories.forEach((factory, name) => {
            scope.factories.set(name, factory);
        });
        this.dependencies.forEach((deps, name) => {
            scope.dependencies.set(name, deps);
        });
        this.singletons.forEach((isSingleton, name) => {
            scope.singletons.set(name, isSingleton);
        });

        return scope;
    }
}

// Create and export the main container
const container = new DependencyContainer();

// Register core services
container.register('logger', () => {
    return { createLogger };
}, []);

container.register('eventBus', () => {
    return window.eventBus || null;
}, []);

// Export for ES6 modules
export default container;

// Legacy global access
if (typeof window !== 'undefined') {
    window.DependencyContainer = container;
}