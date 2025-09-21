/**
 * Application Monitoring Tests
 * Tests for performance and health monitoring system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import monitor from '../../../public/js/core/monitoring.js';

// Mock performance APIs
const mockPerformanceObserver = vi.fn();
const mockPerformance = {
    now: vi.fn(() => 1000),
    memory: {
        usedJSHeapSize: 10000000,
        totalJSHeapSize: 20000000,
        jsHeapSizeLimit: 50000000
    }
};

describe('ApplicationMonitor', () => {
    beforeEach(() => {
        // Reset monitor state
        monitor.clearMetrics();

        // Mock globals
        global.window = {
            PerformanceObserver: mockPerformanceObserver,
            performance: mockPerformance,
            addEventListener: vi.fn(),
            innerWidth: 1920,
            innerHeight: 1080
        };

        global.document = {
            addEventListener: vi.fn(),
            visibilityState: 'visible'
        };

        global.navigator = {
            userAgent: 'test-agent',
            connection: {
                effectiveType: '4g',
                downlink: 10,
                rtt: 100
            }
        };

        global.performance = mockPerformance;

        // Mock PerformanceObserver
        mockPerformanceObserver.mockImplementation((callback) => {
            return {
                observe: vi.fn(),
                disconnect: vi.fn()
            };
        });
    });

    describe('initialization', () => {
        it('should initialize monitoring system', () => {
            monitor.initialize();

            expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
            expect(window.addEventListener).toHaveBeenCalled();
        });

        it('should not initialize twice', () => {
            monitor.initialize();
            const callCount = document.addEventListener.mock.calls.length;

            monitor.initialize();

            expect(document.addEventListener.mock.calls.length).toBe(callCount);
        });
    });

    describe('performance tracking', () => {
        beforeEach(() => {
            monitor.initialize();
        });

        it('should track navigation timing', () => {
            const entry = {
                domContentLoadedEventEnd: 2000,
                domContentLoadedEventStart: 1500,
                loadEventEnd: 3000,
                loadEventStart: 2800,
                domInteractive: 1800,
                fetchStart: 1000,
                responseStart: 1200
            };

            monitor.trackNavigationTiming(entry);

            const metrics = monitor.getPerformanceMetrics();
            expect(metrics.navigation).toBeDefined();
            expect(metrics.navigation.domContentLoaded).toBe(500);
            expect(metrics.navigation.pageLoad).toBe(2000);
            expect(metrics.navigation.ttfb).toBe(200);
        });

        it('should track resource timing', () => {
            const entry = {
                name: 'script.js',
                startTime: 1000,
                responseEnd: 1500
            };

            monitor.trackResourceTiming(entry);

            const metrics = monitor.getPerformanceMetrics();
            expect(metrics.resources).toBeDefined();
            expect(metrics.resources.get('script').count).toBe(1);
            expect(metrics.resources.get('script').totalTime).toBe(500);
        });

        it('should detect slow operations', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const entry = {
                name: 'slow-script.js',
                startTime: 1000,
                responseEnd: 3000 // 2 seconds - slow
            };

            monitor.trackResourceTiming(entry);

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('should track custom metrics', () => {
            monitor.trackCustomMetric('performance', 'customOperation', 150, {
                component: 'TestComponent'
            });

            const metrics = monitor.getPerformanceMetrics();
            expect(metrics.customOperation).toBeDefined();
            expect(metrics.customOperation.value).toBe(150);
            expect(metrics.customOperation.metadata.component).toBe('TestComponent');
        });
    });

    describe('timing operations', () => {
        beforeEach(() => {
            monitor.initialize();
            mockPerformance.now.mockReturnValueOnce(1000).mockReturnValueOnce(1500);
        });

        it('should time operations', () => {
            const endTiming = monitor.startTiming('testOperation');
            const duration = endTiming();

            expect(duration).toBe(500);

            const metrics = monitor.getPerformanceMetrics();
            expect(metrics.testOperation).toBeDefined();
            expect(metrics.testOperation.value).toBe(500);
        });

        it('should mark slow operations', () => {
            mockPerformance.now.mockReturnValueOnce(1000).mockReturnValueOnce(3000); // 2 seconds

            const endTiming = monitor.startTiming('slowOperation');
            const duration = endTiming();

            expect(duration).toBe(2000);

            const metrics = monitor.getPerformanceMetrics();
            expect(metrics.slowOperation.metadata.slow).toBe(true);
        });
    });

    describe('health monitoring', () => {
        beforeEach(() => {
            monitor.initialize();
        });

        it('should track memory usage', () => {
            monitor.trackMemoryUsage();

            const health = monitor.getHealthMetrics();
            expect(health.memory).toBeDefined();
            expect(health.memory.used).toBe(10000000);
            expect(health.memory.total).toBe(20000000);
        });

        it('should detect high memory usage', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            // Mock high memory usage
            mockPerformance.memory.usedJSHeapSize = 60000000; // Above threshold

            monitor.trackMemoryUsage();

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('should track system performance', () => {
            monitor.trackSystemPerformance();

            const health = monitor.getHealthMetrics();
            expect(health.uptime).toBeDefined();
            expect(health.connection).toBeDefined();
            expect(health.connection.effectiveType).toBe('4g');
        });
    });

    describe('user activity tracking', () => {
        beforeEach(() => {
            monitor.initialize();
        });

        it('should track user interactions', () => {
            monitor.trackUserActivity('click');
            monitor.trackUserActivity('click');
            monitor.trackUserActivity('keydown');

            const usage = monitor.getUsageMetrics();
            expect(usage.activity.click).toBe(2);
            expect(usage.activity.keydown).toBe(1);
        });

        it('should track page visibility', () => {
            document.visibilityState = 'hidden';
            monitor.trackPageVisibility();

            const usage = monitor.getUsageMetrics();
            expect(usage.visibility).toBeDefined();
        });

        it('should track idle time', () => {
            const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

            monitor.trackIdleTime(700000); // More than 10 minutes

            expect(consoleSpy).toHaveBeenCalled();

            const usage = monitor.getUsageMetrics();
            expect(usage.idleTime).toBe(700000);

            consoleSpy.mockRestore();
        });
    });

    describe('error tracking', () => {
        beforeEach(() => {
            monitor.initialize();
        });

        it('should track errors', () => {
            monitor.trackError('validation_error', 'FormComponent', {
                field: 'email'
            });

            const errors = monitor.getErrorMetrics();
            expect(errors['validation_error_FormComponent']).toBeDefined();
            expect(errors['validation_error_FormComponent'].count).toBe(1);
            expect(errors['validation_error_FormComponent'].metadata[0].field).toBe('email');
        });

        it('should limit error metadata history', () => {
            // Track more than 10 errors
            for (let i = 0; i < 15; i++) {
                monitor.trackError('test_error', 'TestComponent', { index: i });
            }

            const errors = monitor.getErrorMetrics();
            const errorData = errors['test_error_TestComponent'];

            expect(errorData.count).toBe(15);
            expect(errorData.metadata.length).toBe(10); // Limited to 10
            expect(errorData.metadata[9].index).toBe(14); // Latest entries kept
        });
    });

    describe('health reporting', () => {
        beforeEach(() => {
            monitor.initialize();
        });

        it('should generate health reports', () => {
            // Add some metrics
            monitor.trackCustomMetric('performance', 'lcp', 2000);
            monitor.trackCustomMetric('performance', 'fid', 50);
            monitor.trackError('test_error', 'TestComponent');

            const report = monitor.generateHealthReport();

            expect(report).toHaveProperty('timestamp');
            expect(report).toHaveProperty('uptime');
            expect(report).toHaveProperty('performance');
            expect(report).toHaveProperty('health');
            expect(report).toHaveProperty('usage');
            expect(report).toHaveProperty('errors');
            expect(report).toHaveProperty('healthScore');

            expect(typeof report.healthScore).toBe('number');
            expect(report.healthScore).toBeGreaterThanOrEqual(0);
            expect(report.healthScore).toBeLessThanOrEqual(100);
        });

        it('should calculate health score correctly', () => {
            // Add good metrics
            monitor.trackCustomMetric('performance', 'lcp', 1500); // Good LCP
            monitor.trackCustomMetric('performance', 'fid', 50);   // Good FID

            const report = monitor.generateHealthReport();

            expect(report.healthScore).toBeGreaterThan(80);
        });

        it('should penalize poor performance', () => {
            // Add poor metrics
            monitor.trackCustomMetric('performance', 'lcp', 4000); // Poor LCP
            monitor.trackCustomMetric('performance', 'fid', 200);  // Poor FID

            // High memory usage
            mockPerformance.memory.usedJSHeapSize = 60000000;
            monitor.trackMemoryUsage();

            const report = monitor.generateHealthReport();

            expect(report.healthScore).toBeLessThan(80);
        });

        it('should identify health issues', () => {
            monitor.trackCustomMetric('performance', 'lcp', 3000); // Poor LCP
            mockPerformance.memory.usedJSHeapSize = 60000000;
            monitor.trackMemoryUsage();

            const report = monitor.generateHealthReport();
            const issues = monitor.identifyHealthIssues(report);

            expect(issues).toContain('Poor Largest Contentful Paint');
            expect(issues).toContain('High memory usage');
        });
    });

    describe('metric management', () => {
        beforeEach(() => {
            monitor.initialize();
        });

        it('should export all metrics', () => {
            monitor.trackCustomMetric('test', 'metric1', 100);
            monitor.trackMemoryUsage();
            monitor.trackUserActivity('click');

            const exported = monitor.exportMetrics();

            expect(exported).toHaveProperty('performance');
            expect(exported).toHaveProperty('health');
            expect(exported).toHaveProperty('usage');
            expect(exported).toHaveProperty('errors');
            expect(exported).toHaveProperty('timestamp');
            expect(exported).toHaveProperty('uptime');
        });

        it('should clear all metrics', () => {
            monitor.trackCustomMetric('test', 'metric1', 100);
            monitor.trackMemoryUsage();

            monitor.clearMetrics();

            const exported = monitor.exportMetrics();
            expect(Object.keys(exported.performance)).toHaveLength(0);
            expect(Object.keys(exported.health)).toHaveLength(0);
        });
    });

    describe('resource type detection', () => {
        it('should detect script resources', () => {
            const type = monitor.getResourceType('https://example.com/script.js');
            expect(type).toBe('script');
        });

        it('should detect stylesheet resources', () => {
            const type = monitor.getResourceType('https://example.com/style.css');
            expect(type).toBe('stylesheet');
        });

        it('should detect image resources', () => {
            expect(monitor.getResourceType('image.png')).toBe('image');
            expect(monitor.getResourceType('photo.jpg')).toBe('image');
            expect(monitor.getResourceType('icon.svg')).toBe('image');
        });

        it('should detect API resources', () => {
            const type = monitor.getResourceType('https://example.com/api/users');
            expect(type).toBe('api');
        });

        it('should default to other for unknown types', () => {
            const type = monitor.getResourceType('https://example.com/unknown.xyz');
            expect(type).toBe('other');
        });
    });

    describe('error rate calculation', () => {
        beforeEach(() => {
            monitor.initialize();
        });

        it('should calculate error rates', () => {
            // Simulate operations and errors
            monitor.trackUserActivity('click');
            monitor.trackUserActivity('click');
            monitor.trackUserActivity('click');
            monitor.trackError('test_error', 'Component');

            const errorRate = monitor.calculateErrorRate();

            expect(errorRate).toBeCloseTo(1/3, 2); // 1 error out of 3 operations
        });

        it('should handle zero operations', () => {
            // Don't track any user activity, only errors
            monitor.trackError('test_error', 'Component');

            const errorRate = monitor.calculateErrorRate();

            // When there are no operations tracked (zero total operations),
            // error rate should be 0 even if there are errors
            expect(errorRate).toBe(0);
        });
    });
});