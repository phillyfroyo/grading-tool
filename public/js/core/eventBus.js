/**
 * Event Bus Module
 * Central communication hub for module-to-module communication
 * Replaces the window.Module pattern with proper event-driven architecture
 */

class EventBus {
    constructor() {
        this.events = new Map();
        this.modules = new Map();
        this.debugMode = false;
    }

    /**
     * Register a module with the event bus
     * @param {string} moduleName - Name of the module
     * @param {object} moduleInstance - The module instance
     */
    registerModule(moduleName, moduleInstance) {
        this.modules.set(moduleName, moduleInstance);
        this.log(`Module registered: ${moduleName}`);
    }

    /**
     * Get a registered module
     * @param {string} moduleName - Name of the module
     * @returns {object|null} The module instance or null if not found
     */
    getModule(moduleName) {
        return this.modules.get(moduleName) || null;
    }

    /**
     * Subscribe to an event
     * @param {string} eventName - Name of the event
     * @param {function} callback - Function to call when event is emitted
     * @param {object} context - Optional context for the callback
     */
    on(eventName, callback, context = null) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }

        this.events.get(eventName).push({
            callback,
            context,
            once: false
        });

        this.log(`Event listener added: ${eventName}`);
    }

    /**
     * Subscribe to an event that only fires once
     * @param {string} eventName - Name of the event
     * @param {function} callback - Function to call when event is emitted
     * @param {object} context - Optional context for the callback
     */
    once(eventName, callback, context = null) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }

        this.events.get(eventName).push({
            callback,
            context,
            once: true
        });

        this.log(`One-time event listener added: ${eventName}`);
    }

    /**
     * Unsubscribe from an event
     * @param {string} eventName - Name of the event
     * @param {function} callback - The callback function to remove
     */
    off(eventName, callback) {
        if (!this.events.has(eventName)) {
            return;
        }

        const listeners = this.events.get(eventName);
        const index = listeners.findIndex(listener => listener.callback === callback);

        if (index !== -1) {
            listeners.splice(index, 1);
            this.log(`Event listener removed: ${eventName}`);
        }

        // Clean up empty event arrays
        if (listeners.length === 0) {
            this.events.delete(eventName);
        }
    }

    /**
     * Emit an event
     * @param {string} eventName - Name of the event
     * @param {*} data - Data to pass to the event listeners
     * @returns {boolean} True if the event had listeners, false otherwise
     */
    emit(eventName, data = null) {
        this.log(`Event emitted: ${eventName}`, data);

        if (!this.events.has(eventName)) {
            this.log(`No listeners for event: ${eventName}`);
            return false;
        }

        const listeners = this.events.get(eventName);
        const toRemove = [];

        // Call all listeners
        listeners.forEach((listener, index) => {
            try {
                if (listener.context) {
                    listener.callback.call(listener.context, data);
                } else {
                    listener.callback(data);
                }

                // Mark one-time listeners for removal
                if (listener.once) {
                    toRemove.push(index);
                }
            } catch (error) {
                console.error(`Error in event listener for ${eventName}:`, error);
            }
        });

        // Remove one-time listeners (in reverse order to maintain indices)
        toRemove.reverse().forEach(index => {
            listeners.splice(index, 1);
        });

        // Clean up empty event arrays
        if (listeners.length === 0) {
            this.events.delete(eventName);
        }

        return true;
    }

    /**
     * Request data from a module via event
     * @param {string} eventName - Name of the request event
     * @param {*} requestData - Data to send with the request
     * @returns {Promise} Promise that resolves with the response data
     */
    request(eventName, requestData = null) {
        return new Promise((resolve, reject) => {
            const responseEventName = `${eventName}:response:${Date.now()}`;

            // Set up one-time listener for the response
            this.once(responseEventName, (responseData) => {
                resolve(responseData);
            });

            // Emit the request with response event name
            this.emit(eventName, {
                data: requestData,
                responseEvent: responseEventName
            });

            // Set timeout for request
            setTimeout(() => {
                reject(new Error(`Request timeout for event: ${eventName}`));
            }, 5000);
        });
    }

    /**
     * Respond to a request event
     * @param {object} requestData - The request data object
     * @param {*} responseData - Data to send back
     */
    respond(requestData, responseData) {
        if (requestData && requestData.responseEvent) {
            this.emit(requestData.responseEvent, responseData);
        }
    }

    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Whether to enable debug logging
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    /**
     * Log a message if debug mode is enabled
     * @param {string} message - Message to log
     * @param {*} data - Optional data to log
     */
    log(message, data = null) {
        if (this.debugMode) {
            if (data !== null) {
                console.log(`[EventBus] ${message}`, data);
            } else {
                console.log(`[EventBus] ${message}`);
            }
        }
    }

    /**
     * Get debug information about the event bus
     * @returns {object} Debug information
     */
    getDebugInfo() {
        return {
            registeredModules: Array.from(this.modules.keys()),
            activeEvents: Array.from(this.events.keys()),
            eventListenerCounts: Object.fromEntries(
                Array.from(this.events.entries()).map(([name, listeners]) => [name, listeners.length])
            )
        };
    }

    /**
     * Clear all events and modules (useful for testing)
     */
    clear() {
        this.events.clear();
        this.modules.clear();
        this.log('Event bus cleared');
    }
}

// Create and export the global event bus instance
const eventBus = new EventBus();

// Make it available globally for backward compatibility during transition
if (typeof window !== 'undefined') {
    window.eventBus = eventBus;
}

export default eventBus;