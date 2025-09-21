/**
 * Comprehensive Error Handling Module
 * Provides global error handling, monitoring, and reporting capabilities
 */

import { createLogger } from './logger.js';

const logger = createLogger('ErrorHandler');

class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
        this.errorStats = {
            total: 0,
            byType: new Map(),
            byComponent: new Map(),
            byLevel: new Map(),
            critical: 0
        };
        this.handlers = new Map();
        this.initialized = false;
        this.sessionId = this.generateSessionId();
    }

    /**
     * Initialize error handling
     */
    initialize() {
        if (this.initialized) {
            logger.warn('Error handler already initialized');
            return;
        }

        this.setupGlobalHandlers();
        this.registerDefaultHandlers();
        this.initialized = true;

        logger.info('Error handler initialized');
    }

    /**
     * Set up global error handlers
     */
    setupGlobalHandlers() {
        // Unhandled JavaScript errors
        window.addEventListener('error', (event) => {
            const error = this.createErrorInfo({
                type: 'javascript_error',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                level: 'error'
            });

            this.handleError(error);
        });

        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            const error = this.createErrorInfo({
                type: 'unhandled_promise_rejection',
                message: event.reason?.message || 'Unhandled promise rejection',
                stack: event.reason?.stack,
                level: 'error',
                data: { reason: event.reason }
            });

            this.handleError(error);
        });

        // Resource loading errors
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                const error = this.createErrorInfo({
                    type: 'resource_error',
                    message: `Failed to load resource: ${event.target.src || event.target.href}`,
                    level: 'warning',
                    data: {
                        element: event.target.tagName,
                        src: event.target.src || event.target.href
                    }
                });

                this.handleError(error);
            }
        }, true);

        logger.debug('Global error handlers set up');
    }

    /**
     * Register default error handlers
     */
    registerDefaultHandlers() {
        // Critical error handler
        this.registerHandler('critical', (error) => {
            this.notifyUser(error);
            this.sendErrorReport(error);
        });

        // API error handler
        this.registerHandler('api_error', (error) => {
            if (error.data?.status >= 500) {
                this.notifyUser({
                    ...error,
                    message: 'Server error occurred. Please try again later.'
                });
            }
        });

        // Validation error handler
        this.registerHandler('validation_error', (error) => {
            this.highlightField(error.data?.field);
        });

        logger.debug('Default error handlers registered');
    }

    /**
     * Create standardized error information
     * @param {Object} errorData - Error data
     * @returns {Object} Standardized error info
     */
    createErrorInfo(errorData) {
        return {
            id: this.generateErrorId(),
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            type: errorData.type || 'unknown',
            component: errorData.component || 'unknown',
            message: errorData.message || 'Unknown error',
            level: errorData.level || 'error',
            stack: errorData.stack || null,
            data: errorData.data || {},
            url: window.location.href,
            userAgent: navigator.userAgent,
            handled: false
        };
    }

    /**
     * Handle an error
     * @param {Object} error - Error information
     */
    handleError(error) {
        // Store error
        this.storeError(error);

        // Update statistics
        this.updateStats(error);

        // Log error
        this.logError(error);

        // Execute registered handlers
        this.executeHandlers(error);

        // Mark as handled
        error.handled = true;

        logger.debug('Error handled', { errorId: error.id });
    }

    /**
     * Store error in memory
     * @param {Object} error - Error information
     */
    storeError(error) {
        this.errors.push(error);

        // Maintain max errors limit
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }
    }

    /**
     * Update error statistics
     * @param {Object} error - Error information
     */
    updateStats(error) {
        this.errorStats.total++;

        // By type
        const typeCount = this.errorStats.byType.get(error.type) || 0;
        this.errorStats.byType.set(error.type, typeCount + 1);

        // By component
        const componentCount = this.errorStats.byComponent.get(error.component) || 0;
        this.errorStats.byComponent.set(error.component, componentCount + 1);

        // By level
        const levelCount = this.errorStats.byLevel.get(error.level) || 0;
        this.errorStats.byLevel.set(error.level, levelCount + 1);

        // Critical count
        if (error.level === 'critical') {
            this.errorStats.critical++;
        }
    }

    /**
     * Log error appropriately
     * @param {Object} error - Error information
     */
    logError(error) {
        const logMessage = `[${error.type}] ${error.message}`;
        const logData = {
            errorId: error.id,
            component: error.component,
            stack: error.stack,
            data: error.data
        };

        switch (error.level) {
            case 'critical':
                logger.error(`CRITICAL: ${logMessage}`, logData);
                break;
            case 'error':
                logger.error(logMessage, logData);
                break;
            case 'warning':
                logger.warn(logMessage, logData);
                break;
            default:
                logger.info(logMessage, logData);
                break;
        }
    }

    /**
     * Execute registered handlers for error
     * @param {Object} error - Error information
     */
    executeHandlers(error) {
        // Execute type-specific handlers
        const typeHandlers = this.handlers.get(error.type) || [];
        typeHandlers.forEach(handler => {
            try {
                handler(error);
            } catch (handlerError) {
                logger.error('Error handler failed', {
                    originalError: error.id,
                    handlerError: handlerError.message
                });
            }
        });

        // Execute level-specific handlers
        const levelHandlers = this.handlers.get(error.level) || [];
        levelHandlers.forEach(handler => {
            try {
                handler(error);
            } catch (handlerError) {
                logger.error('Error handler failed', {
                    originalError: error.id,
                    handlerError: handlerError.message
                });
            }
        });
    }

    /**
     * Register an error handler
     * @param {string} type - Error type or level
     * @param {Function} handler - Handler function
     */
    registerHandler(type, handler) {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, []);
        }
        this.handlers.get(type).push(handler);
        logger.debug(`Error handler registered for: ${type}`);
    }

    /**
     * Report an error manually
     * @param {Error|Object} error - Error to report
     * @param {Object} context - Additional context
     */
    reportError(error, context = {}) {
        const errorInfo = this.createErrorInfo({
            type: context.type || 'manual',
            component: context.component || 'unknown',
            message: error.message || error.toString(),
            level: context.level || 'error',
            stack: error.stack,
            data: context.data || {}
        });

        this.handleError(errorInfo);
        return errorInfo.id;
    }

    /**
     * Report a critical error
     * @param {Error|Object} error - Error to report
     * @param {Object} context - Additional context
     */
    reportCriticalError(error, context = {}) {
        return this.reportError(error, {
            ...context,
            level: 'critical'
        });
    }

    /**
     * Wrap a function with error handling
     * @param {Function} fn - Function to wrap
     * @param {Object} context - Error context
     * @returns {Function} Wrapped function
     */
    wrapFunction(fn, context = {}) {
        return (...args) => {
            try {
                const result = fn(...args);

                // Handle async functions
                if (result && typeof result.catch === 'function') {
                    return result.catch(error => {
                        this.reportError(error, {
                            type: 'async_error',
                            component: context.component,
                            data: { args, ...context.data }
                        });
                        throw error;
                    });
                }

                return result;
            } catch (error) {
                this.reportError(error, {
                    type: 'sync_error',
                    component: context.component,
                    data: { args, ...context.data }
                });
                throw error;
            }
        };
    }

    /**
     * Create error boundary for React-like components
     * @param {Function} render - Render function
     * @param {Function} fallback - Fallback render function
     * @param {Object} context - Error context
     * @returns {Function} Error boundary function
     */
    createErrorBoundary(render, fallback, context = {}) {
        return (...args) => {
            try {
                return render(...args);
            } catch (error) {
                this.reportError(error, {
                    type: 'render_error',
                    component: context.component || 'ErrorBoundary',
                    data: { args, ...context.data }
                });

                if (fallback) {
                    try {
                        return fallback(error, ...args);
                    } catch (fallbackError) {
                        this.reportCriticalError(fallbackError, {
                            type: 'fallback_error',
                            component: context.component || 'ErrorBoundary'
                        });
                        return '<div>Critical error occurred</div>';
                    }
                }

                return '<div>An error occurred</div>';
            }
        };
    }

    /**
     * Notify user of error
     * @param {Object} error - Error information
     */
    notifyUser(error) {
        // Use modal system if available
        if (window.ModalManager) {
            this.showErrorModal(error);
            return;
        }

        // Fallback to alert
        const message = error.level === 'critical'
            ? `Critical Error: ${error.message}\n\nPlease refresh the page.`
            : `Error: ${error.message}`;

        alert(message);
    }

    /**
     * Show error modal
     * @param {Object} error - Error information
     */
    showErrorModal(error) {
        try {
            // Implementation depends on modal system
            if (window.ModalManager.showModal) {
                window.ModalManager.showModal(
                    error.level === 'critical' ? 'Critical Error' : 'Error',
                    `<div>
                        <p><strong>Error:</strong> ${error.message}</p>
                        <p><strong>Error ID:</strong> ${error.id}</p>
                        ${error.level === 'critical' ? '<p><em>Please refresh the page.</em></p>' : ''}
                    </div>`,
                    () => {
                        if (error.level === 'critical') {
                            window.location.reload();
                        }
                    }
                );
            }
        } catch (modalError) {
            logger.error('Failed to show error modal', modalError);
            // Fallback to alert
            alert(error.message);
        }
    }

    /**
     * Highlight form field with error
     * @param {string} fieldName - Field name to highlight
     */
    highlightField(fieldName) {
        if (!fieldName) return;

        const field = document.querySelector(`[name="${fieldName}"], #${fieldName}`);
        if (field) {
            field.style.borderColor = '#dc3545';
            field.style.backgroundColor = '#f8d7da';

            // Remove highlight after 5 seconds
            setTimeout(() => {
                field.style.borderColor = '';
                field.style.backgroundColor = '';
            }, 5000);
        }
    }

    /**
     * Send error report to server
     * @param {Object} error - Error information
     */
    async sendErrorReport(error) {
        try {
            await fetch('/api/errors', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error,
                    stats: this.getStats(),
                    recentErrors: this.getRecentErrors(5)
                })
            });
            logger.debug('Error report sent', { errorId: error.id });
        } catch (sendError) {
            logger.error('Failed to send error report', sendError);
        }
    }

    /**
     * Get error statistics
     * @returns {Object} Error statistics
     */
    getStats() {
        return {
            total: this.errorStats.total,
            critical: this.errorStats.critical,
            byType: Object.fromEntries(this.errorStats.byType),
            byComponent: Object.fromEntries(this.errorStats.byComponent),
            byLevel: Object.fromEntries(this.errorStats.byLevel),
            sessionId: this.sessionId
        };
    }

    /**
     * Get recent errors
     * @param {number} count - Number of recent errors
     * @returns {Array} Recent errors
     */
    getRecentErrors(count = 10) {
        return this.errors.slice(-count);
    }

    /**
     * Get errors by type
     * @param {string} type - Error type
     * @returns {Array} Errors of specified type
     */
    getErrorsByType(type) {
        return this.errors.filter(error => error.type === type);
    }

    /**
     * Clear all errors
     */
    clearErrors() {
        this.errors.length = 0;
        this.errorStats = {
            total: 0,
            byType: new Map(),
            byComponent: new Map(),
            byLevel: new Map(),
            critical: 0
        };
        logger.info('Error history cleared');
    }

    /**
     * Generate unique error ID
     * @returns {string} Error ID
     */
    generateErrorId() {
        return 'err_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
    }

    /**
     * Generate unique session ID
     * @returns {string} Session ID
     */
    generateSessionId() {
        return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Generate comprehensive error report
     * @returns {Object} Error report
     */
    generateReport() {
        return {
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            stats: this.getStats(),
            recentErrors: this.getRecentErrors(20),
            systemInfo: {
                userAgent: navigator.userAgent,
                url: window.location.href,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                memory: performance.memory ? {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit
                } : null,
                connection: navigator.connection ? {
                    effectiveType: navigator.connection.effectiveType,
                    downlink: navigator.connection.downlink,
                    rtt: navigator.connection.rtt
                } : null
            }
        };
    }

    /**
     * Destroy error handler
     */
    destroy() {
        // Remove event listeners would go here if we stored references
        this.handlers.clear();
        this.errors.length = 0;
        this.initialized = false;
        logger.info('Error handler destroyed');
    }
}

// Create and export the error handler instance
const errorHandler = new ErrorHandler();

// Export for ES6 modules
export default errorHandler;

// Legacy global access
if (typeof window !== 'undefined') {
    window.ErrorHandler = errorHandler;

    // Convenience functions
    window.reportError = (error, context) => errorHandler.reportError(error, context);
    window.reportCriticalError = (error, context) => errorHandler.reportCriticalError(error, context);
    window.wrapFunction = (fn, context) => errorHandler.wrapFunction(fn, context);
}