/**
 * Service Registry
 * Defines and registers all application services with proper dependencies
 */

import container from './dependency-container.js';
import eventBus from './eventBus.js';
import { createLogger } from './logger.js';

const logger = createLogger('Core:ServiceRegistry');

/**
 * Register all application services
 */
export function registerServices() {
    logger.info('Registering application services...');

    // Core services
    registerCoreServices();

    // UI services
    registerUIServices();

    // Feature services
    registerFeatureServices();

    // Validate dependencies
    const validation = container.validateDependencies();
    if (!validation.valid) {
        logger.error('Dependency validation failed:', validation);
    } else {
        logger.info('All dependencies validated successfully');
    }

    logger.info('Service registration complete');
}

/**
 * Register core services
 */
function registerCoreServices() {
    // Event Bus Service
    container.register('eventBus', () => {
        return eventBus;
    }, []);

    // Logger Service
    container.register('logger', () => {
        return { createLogger };
    }, []);

    // Event Delegation Service
    container.register('eventDelegation', () => {
        return window.EventDelegation;
    }, ['eventBus']);

    // HTTP Service for API calls
    container.register('httpService', () => {
        return new HTTPService();
    }, ['logger']);

    // Storage Service
    container.register('storageService', () => {
        return new StorageService();
    }, ['logger']);
}

/**
 * Register UI services
 */
function registerUIServices() {
    // Modal Manager Service
    container.register('modalManager', () => {
        return window.ModalManager;
    }, ['eventBus']);

    // Tab Management Service
    container.register('tabManager', () => {
        return window.TabManagementModule;
    }, ['eventBus']);

    // Form Handling Service
    container.register('formHandler', () => {
        return window.FormHandlingModule;
    }, ['modalManager', 'httpService']);

    // Keyboard Shortcuts Service
    container.register('keyboardShortcuts', () => {
        return window.KeyboardShortcutsModule;
    }, ['eventBus']);
}

/**
 * Register feature services
 */
function registerFeatureServices() {
    // Highlighting Service
    container.register('highlightingService', () => {
        return window.HighlightingModule;
    }, ['modalManager', 'eventBus']);

    // Text Selection Service
    container.register('textSelectionService', () => {
        return window.TextSelectionModule;
    }, ['eventBus']);

    // Category Selection Service
    container.register('categorySelectionService', () => {
        return window.CategorySelectionModule;
    }, ['highlightingService', 'textSelectionService']);

    // Essay Editing Service
    container.register('essayEditingService', () => {
        return window.EssayEditingModule;
    }, ['highlightingService', 'textSelectionService', 'categorySelectionService']);

    // Grading Display Service
    container.register('gradingDisplayService', () => {
        return window.GradingDisplayModule;
    }, ['eventBus', 'modalManager']);

    // Profiles Service
    container.register('profilesService', () => {
        return window.ProfilesModule;
    }, ['httpService', 'storageService']);

    // PDF Export Service
    container.register('pdfExportService', () => {
        return window.PDFExportModule;
    }, ['highlightingService']);

    // Essay Management Service
    container.register('essayManagementService', () => {
        return window.EssayManagementModule;
    }, ['eventBus']);

    // Batch Processing Service
    container.register('batchProcessingService', () => {
        return window.BatchProcessingModule;
    }, ['gradingDisplayService', 'essayEditingService']);
}

/**
 * HTTP Service for API communication
 */
class HTTPService {
    constructor() {
        this.baseURL = '';
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }

    /**
     * Make HTTP request
     * @param {string} url - Request URL
     * @param {Object} options - Request options
     * @returns {Promise} Request promise
     */
    async request(url, options = {}) {
        const config = {
            headers: { ...this.defaultHeaders, ...options.headers },
            ...options
        };

        try {
            const response = await fetch(this.baseURL + url, config);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            return await response.text();
        } catch (error) {
            logger.error('HTTP request failed:', { url, error });
            throw error;
        }
    }

    /**
     * GET request
     * @param {string} url - Request URL
     * @param {Object} options - Request options
     * @returns {Promise} Request promise
     */
    get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    }

    /**
     * POST request
     * @param {string} url - Request URL
     * @param {*} data - Request data
     * @param {Object} options - Request options
     * @returns {Promise} Request promise
     */
    post(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'POST',
            body: typeof data === 'string' ? data : JSON.stringify(data)
        });
    }

    /**
     * PUT request
     * @param {string} url - Request URL
     * @param {*} data - Request data
     * @param {Object} options - Request options
     * @returns {Promise} Request promise
     */
    put(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'PUT',
            body: typeof data === 'string' ? data : JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     * @param {string} url - Request URL
     * @param {Object} options - Request options
     * @returns {Promise} Request promise
     */
    delete(url, options = {}) {
        return this.request(url, { ...options, method: 'DELETE' });
    }
}

/**
 * Storage Service for local data management
 */
class StorageService {
    constructor() {
        this.prefix = 'gradingTool_';
    }

    /**
     * Set item in localStorage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     */
    set(key, value) {
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(this.prefix + key, serialized);
        } catch (error) {
            logger.error('Failed to store item:', { key, error });
        }
    }

    /**
     * Get item from localStorage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if not found
     * @returns {*} Stored value or default
     */
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(this.prefix + key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            logger.error('Failed to retrieve item:', { key, error });
            return defaultValue;
        }
    }

    /**
     * Remove item from localStorage
     * @param {string} key - Storage key
     */
    remove(key) {
        localStorage.removeItem(this.prefix + key);
    }

    /**
     * Clear all storage items
     */
    clear() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(this.prefix)) {
                localStorage.removeItem(key);
            }
        });
    }

    /**
     * Check if item exists
     * @param {string} key - Storage key
     * @returns {boolean} True if exists
     */
    has(key) {
        return localStorage.getItem(this.prefix + key) !== null;
    }

    /**
     * Get all keys
     * @returns {Array} Array of keys
     */
    keys() {
        const keys = Object.keys(localStorage);
        return keys
            .filter(key => key.startsWith(this.prefix))
            .map(key => key.substring(this.prefix.length));
    }
}

// Initialize services when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerServices);
} else {
    registerServices();
}

export { container, HTTPService, StorageService };