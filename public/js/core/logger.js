/**
 * Logger Module
 * Centralized logging system with different log levels and formatting
 */

class Logger {
    constructor(moduleName = 'App', level = 'info') {
        this.moduleName = moduleName;
        this.level = level;
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
            silent: 4
        };
        this.colors = {
            debug: '#6c757d',
            info: '#007bff',
            warn: '#ffc107',
            error: '#dc3545'
        };
    }

    /**
     * Set the logging level
     * @param {string} level - Log level (debug, info, warn, error, silent)
     */
    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.level = level;
        }
    }

    /**
     * Check if a log level should be output
     * @param {string} level - Log level to check
     * @returns {boolean} True if should log
     */
    shouldLog(level) {
        return this.levels[level] >= this.levels[this.level];
    }

    /**
     * Format a log message
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {*} data - Optional data to include
     * @returns {array} Formatted arguments for console
     */
    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        const color = this.colors[level] || '#000000';

        const formattedMessage = [
            `%c[${timestamp}] [${this.moduleName}] ${level.toUpperCase()}: ${message}`,
            `color: ${color}; font-weight: bold;`
        ];

        if (data !== null) {
            formattedMessage.push(data);
        }

        return formattedMessage;
    }

    /**
     * Log a debug message
     * @param {string} message - Message to log
     * @param {*} data - Optional data to include
     */
    debug(message, data = null) {
        if (this.shouldLog('debug')) {
            console.log(...this.formatMessage('debug', message, data));
        }
    }

    /**
     * Log an info message
     * @param {string} message - Message to log
     * @param {*} data - Optional data to include
     */
    info(message, data = null) {
        if (this.shouldLog('info')) {
            console.log(...this.formatMessage('info', message, data));
        }
    }

    /**
     * Log a warning message
     * @param {string} message - Message to log
     * @param {*} data - Optional data to include
     */
    warn(message, data = null) {
        if (this.shouldLog('warn')) {
            console.warn(...this.formatMessage('warn', message, data));
        }
    }

    /**
     * Log an error message
     * @param {string} message - Message to log
     * @param {*} data - Optional data to include
     */
    error(message, data = null) {
        if (this.shouldLog('error')) {
            console.error(...this.formatMessage('error', message, data));
        }
    }

    /**
     * Log a function entry
     * @param {string} functionName - Name of the function
     * @param {*} args - Function arguments
     */
    enter(functionName, args = null) {
        this.debug(`→ ${functionName}()`, args);
    }

    /**
     * Log a function exit
     * @param {string} functionName - Name of the function
     * @param {*} result - Function result
     */
    exit(functionName, result = null) {
        this.debug(`← ${functionName}()`, result);
    }

    /**
     * Time a function execution
     * @param {string} label - Label for the timer
     * @returns {object} Timer object with end() method
     */
    time(label) {
        const startTime = performance.now();
        console.time(`[${this.moduleName}] ${label}`);

        return {
            end: () => {
                const endTime = performance.now();
                const duration = endTime - startTime;
                console.timeEnd(`[${this.moduleName}] ${label}`);
                this.debug(`${label} completed in ${duration.toFixed(2)}ms`);
                return duration;
            }
        };
    }

    /**
     * Group related log messages
     * @param {string} groupName - Name of the group
     * @param {function} callback - Function to execute within the group
     * @param {boolean} collapsed - Whether to start collapsed
     */
    group(groupName, callback, collapsed = false) {
        if (this.shouldLog('debug')) {
            if (collapsed) {
                console.groupCollapsed(`[${this.moduleName}] ${groupName}`);
            } else {
                console.group(`[${this.moduleName}] ${groupName}`);
            }

            try {
                callback();
            } finally {
                console.groupEnd();
            }
        } else {
            callback();
        }
    }

    /**
     * Log a table of data
     * @param {array|object} data - Data to display in table
     * @param {string} label - Optional label for the table
     */
    table(data, label = 'Data') {
        if (this.shouldLog('debug')) {
            this.debug(label);
            console.table(data);
        }
    }

    /**
     * Create a child logger with a sub-module name
     * @param {string} subModuleName - Name of the sub-module
     * @returns {Logger} New logger instance
     */
    child(subModuleName) {
        return new Logger(`${this.moduleName}:${subModuleName}`, this.level);
    }
}

/**
 * Create logger factory function
 * @param {string} moduleName - Name of the module
 * @param {string} level - Log level
 * @returns {Logger} Logger instance
 */
export function createLogger(moduleName, level = 'info') {
    return new Logger(moduleName, level);
}

// Create and export default logger
export const logger = new Logger('App');

// Make logger available globally for backward compatibility during transition
if (typeof window !== 'undefined') {
    window.logger = logger;
    window.createLogger = createLogger;
}

export default Logger;