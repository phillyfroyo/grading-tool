/**
 * Event System with Pub/Sub Pattern
 *
 * A robust event system that provides publish-subscribe functionality for
 * decoupled communication between different parts of the application.
 * Supports async/sync handlers, error handling, event filtering, and middleware.
 *
 * @example
 * const eventBus = new EventBus();
 * eventBus.on('user.created', (data) => console.log('User created:', data));
 * eventBus.emit('user.created', { id: 1, name: 'John' });
 */

/**
 * Event listener configuration
 * @typedef {Object} EventListener
 * @property {Function} handler - Event handler function
 * @property {Object} [options] - Listener options
 * @property {boolean} [options.once=false] - Remove listener after first execution
 * @property {number} [options.priority=0] - Handler priority (higher = executed first)
 * @property {Function} [options.filter] - Filter function to determine if handler should run
 * @property {Object} [options.context] - Context to bind handler to
 * @property {string} [options.id] - Unique identifier for the listener
 */

/**
 * Event metadata
 * @typedef {Object} EventMetadata
 * @property {string} type - Event type
 * @property {*} data - Event data
 * @property {Date} timestamp - Event timestamp
 * @property {string} source - Event source identifier
 * @property {string} id - Unique event ID
 * @property {boolean} cancelled - Whether event is cancelled
 */

/**
 * Event middleware function
 * @typedef {Function} EventMiddleware
 * @param {EventMetadata} event - Event metadata
 * @param {Function} next - Next middleware function
 */

/**
 * Base Event class for typed events
 */
class BaseEvent {
  constructor(type, data, options = {}) {
    this.type = type;
    this.data = data;
    this.timestamp = new Date();
    this.source = options.source || 'unknown';
    this.id = options.id || this._generateId();
    this.cancelled = false;
    this.metadata = options.metadata || {};
  }

  /**
   * Cancel the event (prevents further propagation)
   */
  cancel() {
    this.cancelled = true;
  }

  /**
   * Check if event is cancelled
   * @returns {boolean}
   */
  isCancelled() {
    return this.cancelled;
  }

  /**
   * Generate unique event ID
   * @private
   * @returns {string}
   */
  _generateId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Event Bus implementation with advanced features
 */
class EventBus {
  constructor(options = {}) {
    /** @type {Map<string, Set<EventListener>>} */
    this._listeners = new Map();
    /** @type {Array<EventMiddleware>} */
    this._middleware = [];
    /** @type {Array<BaseEvent>} */
    this._eventHistory = [];

    this.options = {
      maxHistorySize: options.maxHistorySize || 1000,
      enableHistory: options.enableHistory !== false,
      enableDebugLogging: options.enableDebugLogging || false,
      errorHandling: options.errorHandling || 'log', // 'log', 'throw', 'ignore'
      maxListeners: options.maxListeners || 100,
      enableWildcards: options.enableWildcards !== false,
      asyncByDefault: options.asyncByDefault || false
    };

    this.logger = options.logger || console;
    this._stats = {
      eventsEmitted: 0,
      listenersRegistered: 0,
      errorsHandled: 0
    };
  }

  /**
   * Register an event listener
   *
   * @param {string|Array<string>} eventTypes - Event type(s) to listen for
   * @param {Function} handler - Event handler function
   * @param {Object} [options={}] - Listener options
   * @returns {string} Listener ID for removal
   *
   * @example
   * eventBus.on('user.created', (data) => console.log(data));
   * eventBus.on(['user.created', 'user.updated'], handleUserEvent);
   * eventBus.on('user.*', handleAnyUserEvent, { filter: (event) => event.data.active });
   */
  on(eventTypes, handler, options = {}) {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    const listenerId = options.id || this._generateListenerId();

    for (const eventType of types) {
      this._validateEventType(eventType);
      this._validateHandler(handler);

      if (!this._listeners.has(eventType)) {
        this._listeners.set(eventType, new Set());
      }

      const listeners = this._listeners.get(eventType);

      // Check max listeners limit
      if (listeners.size >= this.options.maxListeners) {
        const warning = `Maximum listeners (${this.options.maxListeners}) reached for event: ${eventType}`;
        this.logger.warn('[EventBus]', warning);
      }

      const listener = {
        id: listenerId,
        handler,
        options: {
          once: options.once || false,
          priority: options.priority || 0,
          filter: options.filter,
          context: options.context,
          async: options.async || this.options.asyncByDefault,
          ...options
        }
      };

      listeners.add(listener);
      this._stats.listenersRegistered++;

      if (this.options.enableDebugLogging) {
        this.logger.debug(`[EventBus] Registered listener for: ${eventType}`);
      }
    }

    return listenerId;
  }

  /**
   * Register a one-time event listener
   *
   * @param {string|Array<string>} eventTypes - Event type(s) to listen for
   * @param {Function} handler - Event handler function
   * @param {Object} [options={}] - Listener options
   * @returns {string} Listener ID
   */
  once(eventTypes, handler, options = {}) {
    return this.on(eventTypes, handler, { ...options, once: true });
  }

  /**
   * Remove event listener(s)
   *
   * @param {string} [eventType] - Event type (if not provided, removes all)
   * @param {string|Function} [identifier] - Listener ID or handler function
   * @returns {number} Number of listeners removed
   */
  off(eventType, identifier) {
    if (!eventType) {
      // Remove all listeners
      const count = Array.from(this._listeners.values())
        .reduce((total, listeners) => total + listeners.size, 0);
      this._listeners.clear();
      return count;
    }

    const listeners = this._listeners.get(eventType);
    if (!listeners) {
      return 0;
    }

    if (!identifier) {
      // Remove all listeners for this event type
      const count = listeners.size;
      listeners.clear();
      return count;
    }

    // Remove specific listener
    let removedCount = 0;
    for (const listener of listeners) {
      if (listener.id === identifier || listener.handler === identifier) {
        listeners.delete(listener);
        removedCount++;
      }
    }

    // Clean up empty event type entries
    if (listeners.size === 0) {
      this._listeners.delete(eventType);
    }

    return removedCount;
  }

  /**
   * Emit an event
   *
   * @param {string} eventType - Event type
   * @param {*} [data] - Event data
   * @param {Object} [options={}] - Emission options
   * @returns {Promise<EventMetadata>} Event metadata
   *
   * @example
   * await eventBus.emit('user.created', { id: 1, name: 'John' });
   * await eventBus.emit('user.updated', userData, { source: 'api' });
   */
  async emit(eventType, data, options = {}) {
    this._validateEventType(eventType);

    const event = new BaseEvent(eventType, data, {
      source: options.source || 'unknown',
      id: options.id,
      metadata: options.metadata
    });

    this._stats.eventsEmitted++;

    if (this.options.enableDebugLogging) {
      this.logger.debug(`[EventBus] Emitting event: ${eventType}`, { data, event });
    }

    // Add to history
    if (this.options.enableHistory) {
      this._addToHistory(event);
    }

    try {
      // Run middleware
      await this._runMiddleware(event);

      if (event.isCancelled()) {
        if (this.options.enableDebugLogging) {
          this.logger.debug(`[EventBus] Event cancelled: ${eventType}`);
        }
        return event;
      }

      // Get all matching listeners
      const matchingListeners = this._getMatchingListeners(eventType);

      // Sort by priority (higher priority first)
      const sortedListeners = Array.from(matchingListeners)
        .sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));

      // Execute listeners
      const promises = [];
      const syncResults = [];

      for (const listener of sortedListeners) {
        if (event.isCancelled()) {
          break;
        }

        try {
          // Apply filter if provided
          if (listener.options.filter && !listener.options.filter(event)) {
            continue;
          }

          // Bind context if provided
          const handler = listener.options.context
            ? listener.handler.bind(listener.options.context)
            : listener.handler;

          // Execute handler
          if (listener.options.async) {
            promises.push(this._executeAsyncHandler(handler, event, listener));
          } else {
            syncResults.push(this._executeSyncHandler(handler, event, listener));
          }

          // Remove one-time listeners
          if (listener.options.once) {
            this._removeListener(eventType, listener);
          }
        } catch (error) {
          this._handleError(error, eventType, listener);
        }
      }

      // Wait for async handlers
      if (promises.length > 0) {
        await Promise.allSettled(promises);
      }

      return event;
    } catch (error) {
      this._handleError(error, eventType);
      throw error;
    }
  }

  /**
   * Emit an event synchronously
   *
   * @param {string} eventType - Event type
   * @param {*} [data] - Event data
   * @param {Object} [options={}] - Emission options
   * @returns {EventMetadata} Event metadata
   */
  emitSync(eventType, data, options = {}) {
    this._validateEventType(eventType);

    const event = new BaseEvent(eventType, data, options);
    this._stats.eventsEmitted++;

    if (this.options.enableHistory) {
      this._addToHistory(event);
    }

    // Get matching listeners
    const matchingListeners = this._getMatchingListeners(eventType);

    // Sort by priority
    const sortedListeners = Array.from(matchingListeners)
      .sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));

    // Execute listeners synchronously
    for (const listener of sortedListeners) {
      if (event.isCancelled()) {
        break;
      }

      try {
        if (listener.options.filter && !listener.options.filter(event)) {
          continue;
        }

        const handler = listener.options.context
          ? listener.handler.bind(listener.options.context)
          : listener.handler;

        this._executeSyncHandler(handler, event, listener);

        if (listener.options.once) {
          this._removeListener(eventType, listener);
        }
      } catch (error) {
        this._handleError(error, eventType, listener);
      }
    }

    return event;
  }

  /**
   * Add middleware to the event pipeline
   *
   * @param {EventMiddleware} middleware - Middleware function
   * @returns {EventBus} This instance for chaining
   */
  use(middleware) {
    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function');
    }

    this._middleware.push(middleware);
    return this;
  }

  /**
   * Wait for a specific event
   *
   * @param {string} eventType - Event type to wait for
   * @param {Object} [options={}] - Wait options
   * @param {number} [options.timeout] - Timeout in milliseconds
   * @param {Function} [options.filter] - Filter function
   * @returns {Promise<EventMetadata>} Promise that resolves with event data
   */
  waitFor(eventType, options = {}) {
    return new Promise((resolve, reject) => {
      let timeoutId;

      const handler = (event) => {
        if (options.filter && !options.filter(event)) {
          return;
        }

        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve(event);
      };

      const listenerId = this.once(eventType, handler);

      if (options.timeout) {
        timeoutId = setTimeout(() => {
          this.off(eventType, listenerId);
          reject(new Error(`Timeout waiting for event: ${eventType}`));
        }, options.timeout);
      }
    });
  }

  /**
   * Get event history
   *
   * @param {Object} [filter={}] - Filter options
   * @param {string} [filter.type] - Filter by event type
   * @param {Date} [filter.since] - Filter by timestamp
   * @param {number} [filter.limit] - Limit number of results
   * @returns {Array<BaseEvent>} Event history
   */
  getHistory(filter = {}) {
    if (!this.options.enableHistory) {
      return [];
    }

    let events = [...this._eventHistory];

    if (filter.type) {
      events = events.filter(event =>
        this.options.enableWildcards
          ? this._matchesPattern(event.type, filter.type)
          : event.type === filter.type
      );
    }

    if (filter.since) {
      events = events.filter(event => event.timestamp >= filter.since);
    }

    if (filter.limit) {
      events = events.slice(-filter.limit);
    }

    return events;
  }

  /**
   * Get listener count for an event type
   *
   * @param {string} [eventType] - Event type (if not provided, returns total)
   * @returns {number} Listener count
   */
  listenerCount(eventType) {
    if (!eventType) {
      return Array.from(this._listeners.values())
        .reduce((total, listeners) => total + listeners.size, 0);
    }

    const listeners = this._listeners.get(eventType);
    return listeners ? listeners.size : 0;
  }

  /**
   * Get all event types with listeners
   *
   * @returns {Array<string>} Array of event types
   */
  eventNames() {
    return Array.from(this._listeners.keys());
  }

  /**
   * Get event bus statistics
   *
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this._stats,
      eventTypes: this._listeners.size,
      totalListeners: this.listenerCount(),
      historySize: this._eventHistory.length,
      middlewareCount: this._middleware.length
    };
  }

  /**
   * Clear all listeners and history
   */
  clear() {
    this._listeners.clear();
    this._eventHistory = [];
    this._middleware = [];
    this._stats = {
      eventsEmitted: 0,
      listenersRegistered: 0,
      errorsHandled: 0
    };
  }

  /**
   * Get matching listeners for an event type
   *
   * @private
   * @param {string} eventType - Event type
   * @returns {Set<EventListener>} Matching listeners
   */
  _getMatchingListeners(eventType) {
    const matchingListeners = new Set();

    // Direct match
    const directListeners = this._listeners.get(eventType);
    if (directListeners) {
      directListeners.forEach(listener => matchingListeners.add(listener));
    }

    // Wildcard matching
    if (this.options.enableWildcards) {
      for (const [pattern, listeners] of this._listeners) {
        if (pattern !== eventType && this._matchesPattern(eventType, pattern)) {
          listeners.forEach(listener => matchingListeners.add(listener));
        }
      }
    }

    return matchingListeners;
  }

  /**
   * Check if event type matches wildcard pattern
   *
   * @private
   * @param {string} eventType - Event type
   * @param {string} pattern - Pattern with wildcards
   * @returns {boolean} Whether type matches pattern
   */
  _matchesPattern(eventType, pattern) {
    if (!pattern.includes('*')) {
      return eventType === pattern;
    }

    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(eventType);
  }

  /**
   * Execute async event handler
   *
   * @private
   * @param {Function} handler - Handler function
   * @param {EventMetadata} event - Event metadata
   * @param {EventListener} listener - Listener metadata
   * @returns {Promise}
   */
  async _executeAsyncHandler(handler, event, listener) {
    try {
      await handler(event.data, event);
    } catch (error) {
      this._handleError(error, event.type, listener);
    }
  }

  /**
   * Execute sync event handler
   *
   * @private
   * @param {Function} handler - Handler function
   * @param {EventMetadata} event - Event metadata
   * @param {EventListener} listener - Listener metadata
   * @returns {*} Handler result
   */
  _executeSyncHandler(handler, event, listener) {
    try {
      return handler(event.data, event);
    } catch (error) {
      this._handleError(error, event.type, listener);
    }
  }

  /**
   * Run middleware pipeline
   *
   * @private
   * @param {EventMetadata} event - Event metadata
   * @returns {Promise}
   */
  async _runMiddleware(event) {
    let index = 0;

    const next = async () => {
      if (index >= this._middleware.length) {
        return;
      }

      const middleware = this._middleware[index++];
      await middleware(event, next);
    };

    await next();
  }

  /**
   * Add event to history
   *
   * @private
   * @param {BaseEvent} event - Event to add
   */
  _addToHistory(event) {
    this._eventHistory.push(event);

    // Trim history if it exceeds max size
    if (this._eventHistory.length > this.options.maxHistorySize) {
      this._eventHistory.shift();
    }
  }

  /**
   * Remove specific listener
   *
   * @private
   * @param {string} eventType - Event type
   * @param {EventListener} listener - Listener to remove
   */
  _removeListener(eventType, listener) {
    const listeners = this._listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this._listeners.delete(eventType);
      }
    }
  }

  /**
   * Handle event processing errors
   *
   * @private
   * @param {Error} error - Error that occurred
   * @param {string} eventType - Event type
   * @param {EventListener} [listener] - Listener that caused error
   */
  _handleError(error, eventType, listener) {
    this._stats.errorsHandled++;

    const errorInfo = {
      error,
      eventType,
      listener: listener ? listener.id : null,
      timestamp: new Date()
    };

    switch (this.options.errorHandling) {
      case 'throw':
        throw error;
      case 'ignore':
        break;
      case 'log':
      default:
        this.logger.error('[EventBus] Error in event handler:', errorInfo);
        break;
    }

    // Emit error event
    process.nextTick(() => {
      this.emitSync('eventbus.error', errorInfo);
    });
  }

  /**
   * Validate event type
   *
   * @private
   * @param {string} eventType - Event type to validate
   */
  _validateEventType(eventType) {
    if (!eventType || typeof eventType !== 'string') {
      throw new Error('Event type must be a non-empty string');
    }
  }

  /**
   * Validate event handler
   *
   * @private
   * @param {Function} handler - Handler to validate
   */
  _validateHandler(handler) {
    if (typeof handler !== 'function') {
      throw new Error('Event handler must be a function');
    }
  }

  /**
   * Generate unique listener ID
   *
   * @private
   * @returns {string} Listener ID
   */
  _generateListenerId() {
    return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Global event bus instance
 */
let globalEventBus = null;

/**
 * Get or create global event bus
 *
 * @param {Object} [options] - Event bus options
 * @returns {EventBus} Global event bus
 */
function getGlobalEventBus(options) {
  if (!globalEventBus) {
    globalEventBus = new EventBus(options);
  }
  return globalEventBus;
}

/**
 * Set global event bus
 *
 * @param {EventBus} eventBus - Event bus to set as global
 */
function setGlobalEventBus(eventBus) {
  if (!(eventBus instanceof EventBus)) {
    throw new Error('Global event bus must be an instance of EventBus');
  }
  globalEventBus = eventBus;
}

export {
  EventBus,
  BaseEvent,
  getGlobalEventBus,
  setGlobalEventBus
};