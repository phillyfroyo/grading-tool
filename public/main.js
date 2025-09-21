/**
 * Modern Application Entry Point
 * Handles ES6 module loading and initialization with Vite support
 */

// Import core modules
import eventBus from './js/core/eventBus.js';
import { createLogger } from './js/core/logger.js';
import eventDelegation from './js/core/event-delegation.js';
import errorHandler from './js/core/error-handler.js';
import monitor from './js/core/monitoring.js';
import { container, registerServices } from './js/core/service-registry.js';

// Import UI modules
import modalManager from './js/ui/modals.js';

const logger = createLogger('App:Main');

class Application {
    constructor() {
        this.initialized = false;
        this.modules = new Map();
    }

    /**
     * Initialize the application
     */
    async initialize() {
        if (this.initialized) {
            logger.warn('Application already initialized');
            return;
        }

        logger.info('🚀 Initializing modern application...');

        try {
            // Register all services with dependency injection
            registerServices();

            // Initialize core systems first
            await this.initializeCore();

            // Initialize all services using dependency container
            await this.initializeServices();

            // Set up global error handling
            this.setupErrorHandling();

            this.initialized = true;
            logger.info('✅ Modern application initialized successfully');

            // Log module status
            this.logModuleStatus();

        } catch (error) {
            logger.error('❌ Failed to initialize application:', error);
            throw error;
        }
    }

    /**
     * Initialize core systems
     */
    async initializeCore() {
        logger.info('Initializing core systems...');

        try {
            // Initialize error handler first
            if (errorHandler && typeof errorHandler.initialize === 'function') {
                errorHandler.initialize();
                this.modules.set('errorHandler', errorHandler);
                logger.debug('Error handler initialized');
            }

            // Initialize monitoring system
            if (monitor && typeof monitor.initialize === 'function') {
                monitor.initialize();
                this.modules.set('monitor', monitor);
                logger.debug('Monitoring system initialized');
            }

            // Initialize event bus
            if (eventBus && typeof eventBus.initialize === 'function') {
                eventBus.initialize();
                this.modules.set('eventBus', eventBus);
                logger.debug('Event bus initialized');
            }

            // Initialize event delegation
            if (eventDelegation && typeof eventDelegation.initialize === 'function') {
                eventDelegation.initialize();
                this.modules.set('eventDelegation', eventDelegation);
                logger.debug('Event delegation initialized');
            }

            logger.info('✅ Core systems initialized successfully');

        } catch (error) {
            logger.error('Failed to initialize core systems:', error);
            throw error;
        }
    }

    /**
     * Initialize all services using dependency container
     */
    async initializeServices() {
        logger.info('Initializing services with dependency injection...');

        try {
            const result = await container.initializeAll();

            // Store initialized services
            result.initialized.forEach(serviceName => {
                try {
                    const service = container.get(serviceName);
                    this.modules.set(serviceName, service);
                } catch (error) {
                    logger.error(`Failed to get service ${serviceName}:`, error);
                }
            });

            logger.info(`✅ Services initialized: ${result.initialized.length} success, ${result.failed.length} failed`);

            if (result.failed.length > 0) {
                logger.warn('Failed to initialize services:', result.failed.map(f => f.name));
            }

        } catch (error) {
            logger.error('Failed to initialize services:', error);
            throw error;
        }
    }

    /**
     * Set up global error handling
     */
    setupErrorHandling() {
        // Global error handler
        window.addEventListener('error', (event) => {
            logger.error('Global error caught:', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error
            });
        });

        // Promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            logger.error('Unhandled promise rejection:', event.reason);
        });

        // Module loading error handler
        window.addEventListener('error', (event) => {
            if (event.target.tagName === 'SCRIPT') {
                logger.error('Script loading error:', {
                    src: event.target.src,
                    error: event
                });
            }
        }, true);

        logger.info('✅ Global error handling set up');
    }

    /**
     * Log the status of all modules
     */
    logModuleStatus() {
        const status = {};
        this.modules.forEach((module, name) => {
            status[name] = !!module;
        });

        // Add legacy modules
        status.legacy = {
            UIInteractionsModule: !!window.UIInteractionsModule,
            EssayManagementModule: !!window.EssayManagementModule,
            BatchProcessingModule: !!window.BatchProcessingModule,
            DisplayUtilsModule: !!window.DisplayUtilsModule
        };

        logger.info('📊 Module status:', status);
    }

    /**
     * Get a module by name
     * @param {string} name - Module name
     * @returns {object|null} Module instance or null
     */
    getModule(name) {
        // Try to get from modules first
        if (this.modules.has(name)) {
            return this.modules.get(name);
        }

        // Try to get from dependency container
        try {
            return container.get(name);
        } catch (error) {
            logger.debug(`Module not found: ${name}`);
            return null;
        }
    }

    /**
     * Get a service using dependency injection
     * @param {string} serviceName - Service name
     * @returns {object|null} Service instance or null
     */
    getService(serviceName) {
        try {
            return container.get(serviceName);
        } catch (error) {
            logger.error(`Service not found: ${serviceName}`, error);
            return null;
        }
    }

    /**
     * Check if application is initialized
     * @returns {boolean} True if initialized
     */
    isInitialized() {
        return this.initialized;
    }

    /**
     * Destroy the application
     */
    destroy() {
        logger.info('🔄 Destroying application...');

        // Destroy modules in reverse order
        this.modules.forEach((module, name) => {
            if (module && typeof module.destroy === 'function') {
                try {
                    module.destroy();
                    logger.debug(`Destroyed module: ${name}`);
                } catch (error) {
                    logger.error(`Error destroying module ${name}:`, error);
                }
            }
        });

        this.modules.clear();
        this.initialized = false;

        logger.info('✅ Application destroyed');
    }
}

// Create application instance
const app = new Application();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app.initialize();
    });
} else {
    // DOM is already ready
    app.initialize();
}

// Export for global access and debugging
window.App = app;

export default app;