/**
 * Application Monitoring Module
 * Tracks performance, usage, and system health metrics
 */

import { createLogger } from './logger.js';

const logger = createLogger('Monitoring');

class ApplicationMonitor {
    constructor() {
        this.metrics = {
            performance: new Map(),
            usage: new Map(),
            health: new Map(),
            errors: new Map()
        };
        this.thresholds = {
            slowOperation: 1000, // 1 second
            memoryWarning: 50 * 1024 * 1024, // 50MB
            errorRate: 0.1, // 10% error rate
            responseTime: 5000 // 5 seconds
        };
        this.intervals = new Map();
        this.startTime = Date.now();
        this.initialized = false;
    }

    /**
     * Initialize monitoring
     */
    initialize() {
        if (this.initialized) {
            logger.warn('Monitoring already initialized');
            return;
        }

        this.setupPerformanceObserver();
        this.startSystemMonitoring();
        this.setupUserActivityTracking();
        this.initialized = true;

        logger.info('Application monitoring initialized');
    }

    /**
     * Set up performance observer
     */
    setupPerformanceObserver() {
        if ('PerformanceObserver' in window) {
            // Monitor navigation timing
            const navObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.trackNavigationTiming(entry);
                }
            });
            navObserver.observe({ type: 'navigation', buffered: true });

            // Monitor resource timing
            const resourceObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.trackResourceTiming(entry);
                }
            });
            resourceObserver.observe({ type: 'resource', buffered: true });

            // Monitor largest contentful paint
            const lcpObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.trackLCP(entry);
                }
            });
            lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

            // Monitor first input delay
            const fidObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.trackFID(entry);
                }
            });
            fidObserver.observe({ type: 'first-input', buffered: true });

            logger.debug('Performance observers set up');
        }
    }

    /**
     * Start system monitoring intervals
     */
    startSystemMonitoring() {
        // Monitor memory usage every 30 seconds
        this.intervals.set('memory', setInterval(() => {
            this.trackMemoryUsage();
        }, 30000));

        // Monitor performance every minute
        this.intervals.set('performance', setInterval(() => {
            this.trackSystemPerformance();
        }, 60000));

        // Generate health report every 5 minutes
        this.intervals.set('health', setInterval(() => {
            this.generateHealthReport();
        }, 300000));

        logger.debug('System monitoring intervals started');
    }

    /**
     * Set up user activity tracking
     */
    setupUserActivityTracking() {
        let lastActivity = Date.now();

        // Track user interactions
        ['click', 'keydown', 'scroll', 'mousemove'].forEach(event => {
            document.addEventListener(event, () => {
                lastActivity = Date.now();
                this.trackUserActivity(event);
            }, { passive: true });
        });

        // Track page visibility
        document.addEventListener('visibilitychange', () => {
            this.trackPageVisibility();
        });

        // Track idle time
        this.intervals.set('idle', setInterval(() => {
            const idleTime = Date.now() - lastActivity;
            this.trackIdleTime(idleTime);
        }, 10000));

        logger.debug('User activity tracking set up');
    }

    /**
     * Track navigation timing
     * @param {PerformanceNavigationTiming} entry - Navigation timing entry
     */
    trackNavigationTiming(entry) {
        const metrics = {
            domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
            loadComplete: entry.loadEventEnd - entry.loadEventStart,
            domInteractive: entry.domInteractive - entry.fetchStart,
            pageLoad: entry.loadEventEnd - entry.fetchStart,
            ttfb: entry.responseStart - entry.fetchStart
        };

        this.metrics.performance.set('navigation', metrics);

        // Check for slow page load
        if (metrics.pageLoad > this.thresholds.responseTime) {
            logger.warn('Slow page load detected', { pageLoad: metrics.pageLoad });
        }

        logger.debug('Navigation timing tracked', metrics);
    }

    /**
     * Track resource timing
     * @param {PerformanceResourceTiming} entry - Resource timing entry
     */
    trackResourceTiming(entry) {
        const duration = entry.responseEnd - entry.startTime;
        const resourceType = this.getResourceType(entry.name);

        if (!this.metrics.performance.has('resources')) {
            this.metrics.performance.set('resources', new Map());
        }

        const resources = this.metrics.performance.get('resources');
        const typeMetrics = resources.get(resourceType) || {
            count: 0,
            totalTime: 0,
            avgTime: 0,
            maxTime: 0,
            slowCount: 0
        };

        typeMetrics.count++;
        typeMetrics.totalTime += duration;
        typeMetrics.avgTime = typeMetrics.totalTime / typeMetrics.count;
        typeMetrics.maxTime = Math.max(typeMetrics.maxTime, duration);

        if (duration > this.thresholds.slowOperation) {
            typeMetrics.slowCount++;
            logger.warn('Slow resource load', {
                resource: entry.name,
                duration,
                type: resourceType
            });
        }

        resources.set(resourceType, typeMetrics);
    }

    /**
     * Track Largest Contentful Paint
     * @param {PerformancePaintTiming} entry - LCP entry
     */
    trackLCP(entry) {
        this.metrics.performance.set('lcp', entry.startTime);

        if (entry.startTime > 2500) { // LCP should be < 2.5s for good UX
            logger.warn('Poor LCP detected', { lcp: entry.startTime });
        }
    }

    /**
     * Track First Input Delay
     * @param {PerformanceEventTiming} entry - FID entry
     */
    trackFID(entry) {
        const fid = entry.processingStart - entry.startTime;
        this.metrics.performance.set('fid', fid);

        if (fid > 100) { // FID should be < 100ms for good UX
            logger.warn('Poor FID detected', { fid });
        }
    }

    /**
     * Track memory usage
     */
    trackMemoryUsage() {
        if (performance.memory) {
            const memory = {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit,
                timestamp: Date.now()
            };

            this.metrics.health.set('memory', memory);

            // Check for memory warnings
            if (memory.used > this.thresholds.memoryWarning) {
                logger.warn('High memory usage detected', memory);
            }

            // Check for memory leaks (usage trending upward)
            this.checkMemoryTrend();
        }
    }

    /**
     * Check memory usage trend
     */
    checkMemoryTrend() {
        const memoryHistory = this.getMetricHistory('health', 'memory', 10);
        if (memoryHistory.length >= 5) {
            const recent = memoryHistory.slice(-5);
            const trend = recent.reduce((acc, curr, index) => {
                if (index === 0) return acc;
                return acc + (curr.used - recent[index - 1].used);
            }, 0);

            if (trend > 10 * 1024 * 1024) { // 10MB increase trend
                logger.warn('Potential memory leak detected', {
                    trend: `+${Math.round(trend / 1024 / 1024)}MB`,
                    samples: recent.length
                });
            }
        }
    }

    /**
     * Track system performance
     */
    trackSystemPerformance() {
        const now = Date.now();
        const uptime = now - this.startTime;

        // CPU usage approximation using timing
        const start = performance.now();
        setTimeout(() => {
            const delay = performance.now() - start;
            const cpuUsage = Math.max(0, Math.min(100, delay - 16)); // 16ms baseline

            this.metrics.health.set('cpu', {
                usage: cpuUsage,
                timestamp: now
            });

            if (cpuUsage > 80) {
                logger.warn('High CPU usage detected', { usage: cpuUsage });
            }
        }, 0);

        // Track application uptime
        this.metrics.health.set('uptime', uptime);

        // Track connection quality
        if (navigator.connection) {
            this.metrics.health.set('connection', {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt,
                timestamp: now
            });
        }
    }

    /**
     * Track user activity
     * @param {string} type - Activity type
     */
    trackUserActivity(type) {
        const activity = this.metrics.usage.get('activity') || new Map();
        const count = activity.get(type) || 0;
        activity.set(type, count + 1);
        this.metrics.usage.set('activity', activity);
    }

    /**
     * Track page visibility
     */
    trackPageVisibility() {
        const visibility = this.metrics.usage.get('visibility') || {
            visible: 0,
            hidden: 0,
            lastChange: Date.now()
        };

        const now = Date.now();
        const duration = now - visibility.lastChange;

        if (document.visibilityState === 'visible') {
            visibility.hidden += duration;
        } else {
            visibility.visible += duration;
        }

        visibility.lastChange = now;
        this.metrics.usage.set('visibility', visibility);
    }

    /**
     * Track idle time
     * @param {number} idleTime - Time since last activity
     */
    trackIdleTime(idleTime) {
        this.metrics.usage.set('idleTime', idleTime);

        // Log if user has been idle for more than 10 minutes
        if (idleTime > 600000) {
            logger.debug('User idle detected', { idleTime: Math.round(idleTime / 1000) + 's' });
        }
    }

    /**
     * Track custom metric
     * @param {string} category - Metric category
     * @param {string} name - Metric name
     * @param {*} value - Metric value
     * @param {Object} metadata - Additional metadata
     */
    trackCustomMetric(category, name, value, metadata = {}) {
        if (!this.metrics[category]) {
            this.metrics[category] = new Map();
        }

        const metric = {
            value,
            timestamp: Date.now(),
            metadata
        };

        this.metrics[category].set(name, metric);
        logger.debug(`Custom metric tracked: ${category}.${name}`, metric);
    }

    /**
     * Start timing an operation
     * @param {string} operation - Operation name
     * @returns {Function} End timing function
     */
    startTiming(operation) {
        const startTime = performance.now();

        return (metadata = {}) => {
            const duration = performance.now() - startTime;

            this.trackCustomMetric('performance', operation, duration, {
                ...metadata,
                slow: duration > this.thresholds.slowOperation
            });

            if (duration > this.thresholds.slowOperation) {
                logger.warn(`Slow operation: ${operation}`, {
                    duration: `${duration.toFixed(2)}ms`,
                    ...metadata
                });
            }

            return duration;
        };
    }

    /**
     * Track error occurrence
     * @param {string} type - Error type
     * @param {string} component - Component name
     * @param {Object} metadata - Error metadata
     */
    trackError(type, component, metadata = {}) {
        const errorKey = `${type}_${component}`;
        const errorMetric = this.metrics.errors.get(errorKey) || {
            count: 0,
            lastOccurrence: null,
            metadata: []
        };

        errorMetric.count++;
        errorMetric.lastOccurrence = Date.now();
        errorMetric.metadata.push({
            ...metadata,
            timestamp: Date.now()
        });

        // Keep only last 10 occurrences
        if (errorMetric.metadata.length > 10) {
            errorMetric.metadata.shift();
        }

        this.metrics.errors.set(errorKey, errorMetric);
    }

    /**
     * Generate health report
     */
    generateHealthReport() {
        const report = {
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime,
            performance: this.getPerformanceMetrics(),
            health: this.getHealthMetrics(),
            usage: this.getUsageMetrics(),
            errors: this.getErrorMetrics()
        };

        // Check overall health
        const healthScore = this.calculateHealthScore(report);
        report.healthScore = healthScore;

        if (healthScore < 70) {
            logger.warn('Poor application health detected', {
                score: healthScore,
                issues: this.identifyHealthIssues(report)
            });
        }

        logger.info('Health report generated', {
            score: healthScore,
            uptime: Math.round(report.uptime / 1000) + 's'
        });

        return report;
    }

    /**
     * Calculate application health score
     * @param {Object} report - Health report
     * @returns {number} Health score (0-100)
     */
    calculateHealthScore(report) {
        let score = 100;

        // Performance penalties
        if (report.performance.lcp > 2500) score -= 10;
        if (report.performance.fid > 100) score -= 10;
        if (report.health.memory?.used > this.thresholds.memoryWarning) score -= 15;
        if (report.health.cpu?.usage > 80) score -= 15;

        // Error penalties
        const errorRate = this.calculateErrorRate();
        if (errorRate > this.thresholds.errorRate) {
            score -= Math.min(30, errorRate * 100);
        }

        return Math.max(0, Math.round(score));
    }

    /**
     * Identify health issues
     * @param {Object} report - Health report
     * @returns {Array} Array of health issues
     */
    identifyHealthIssues(report) {
        const issues = [];

        if (report.performance.lcp > 2500) {
            issues.push('Poor Largest Contentful Paint');
        }
        if (report.performance.fid > 100) {
            issues.push('Poor First Input Delay');
        }
        if (report.health.memory?.used > this.thresholds.memoryWarning) {
            issues.push('High memory usage');
        }
        if (report.health.cpu?.usage > 80) {
            issues.push('High CPU usage');
        }

        const errorRate = this.calculateErrorRate();
        if (errorRate > this.thresholds.errorRate) {
            issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
        }

        return issues;
    }

    /**
     * Calculate error rate
     * @returns {number} Error rate (0-1)
     */
    calculateErrorRate() {
        const totalOperations = this.getTotalOperations();
        const totalErrors = this.getTotalErrors();

        return totalOperations > 0 ? totalErrors / totalOperations : 0;
    }

    /**
     * Get total operations count
     * @returns {number} Total operations
     */
    getTotalOperations() {
        // This is an approximation based on user activity
        const activity = this.metrics.usage.get('activity');
        if (!activity) return 0;

        const total = Array.from(activity.values()).reduce((sum, count) => sum + count, 0);
        return total > 0 ? total : 0;
    }

    /**
     * Get total errors count
     * @returns {number} Total errors
     */
    getTotalErrors() {
        return Array.from(this.metrics.errors.values())
            .reduce((sum, error) => sum + error.count, 0);
    }

    /**
     * Get resource type from URL
     * @param {string} url - Resource URL
     * @returns {string} Resource type
     */
    getResourceType(url) {
        if (url.includes('.js')) return 'script';
        if (url.includes('.css')) return 'stylesheet';
        if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) return 'image';
        if (url.includes('.woff') || url.includes('.ttf')) return 'font';
        if (url.includes('/api/')) return 'api';
        return 'other';
    }

    /**
     * Get metric history
     * @param {string} category - Metric category
     * @param {string} name - Metric name
     * @param {number} count - Number of historical entries
     * @returns {Array} Metric history
     */
    getMetricHistory(category, name, count = 10) {
        // This would need to be implemented with proper historical storage
        // For now, return current value
        const current = this.metrics[category]?.get(name);
        return current ? [current] : [];
    }

    /**
     * Get performance metrics
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics() {
        return Object.fromEntries(this.metrics.performance);
    }

    /**
     * Get health metrics
     * @returns {Object} Health metrics
     */
    getHealthMetrics() {
        return Object.fromEntries(this.metrics.health);
    }

    /**
     * Get usage metrics
     * @returns {Object} Usage metrics
     */
    getUsageMetrics() {
        const usage = {};
        this.metrics.usage.forEach((value, key) => {
            if (value instanceof Map) {
                usage[key] = Object.fromEntries(value);
            } else {
                usage[key] = value;
            }
        });
        return usage;
    }

    /**
     * Get error metrics
     * @returns {Object} Error metrics
     */
    getErrorMetrics() {
        return Object.fromEntries(this.metrics.errors);
    }

    /**
     * Export all metrics
     * @returns {Object} All metrics
     */
    exportMetrics() {
        return {
            performance: this.getPerformanceMetrics(),
            health: this.getHealthMetrics(),
            usage: this.getUsageMetrics(),
            errors: this.getErrorMetrics(),
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime
        };
    }

    /**
     * Clear all metrics
     */
    clearMetrics() {
        Object.values(this.metrics).forEach(metric => {
            if (metric instanceof Map) {
                metric.clear();
            }
        });
        logger.info('All metrics cleared');
    }

    /**
     * Destroy monitoring
     */
    destroy() {
        // Clear all intervals
        this.intervals.forEach((interval, name) => {
            clearInterval(interval);
            logger.debug(`Cleared interval: ${name}`);
        });
        this.intervals.clear();

        // Clear metrics
        this.clearMetrics();

        this.initialized = false;
        logger.info('Application monitoring destroyed');
    }
}

// Create and export the monitor instance
const monitor = new ApplicationMonitor();

// Export for ES6 modules
export default monitor;

// Legacy global access
if (typeof window !== 'undefined') {
    window.ApplicationMonitor = monitor;

    // Convenience functions
    window.trackMetric = (category, name, value, metadata) =>
        monitor.trackCustomMetric(category, name, value, metadata);
    window.startTiming = (operation) => monitor.startTiming(operation);
    window.trackError = (type, component, metadata) =>
        monitor.trackError(type, component, metadata);
}