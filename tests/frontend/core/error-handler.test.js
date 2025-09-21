/**
 * Error Handler Tests
 * Tests for the comprehensive error handling system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import errorHandler from '../../../public/js/core/error-handler.js';

// Mock console methods
const originalConsole = { ...console };

describe('ErrorHandler', () => {
    beforeEach(() => {
        errorHandler.clearErrors();

        // Mock console methods to avoid noise in tests
        console.error = vi.fn();
        console.warn = vi.fn();
        console.log = vi.fn();

        // Mock DOM methods
        global.document = {
            querySelector: vi.fn(),
            addEventListener: vi.fn()
        };

        global.window = {
            addEventListener: vi.fn(),
            location: { href: 'http://test.com' },
            alert: vi.fn()
        };

        global.navigator = {
            userAgent: 'test-agent'
        };

        global.fetch = vi.fn();
    });

    afterEach(() => {
        // Restore console
        Object.assign(console, originalConsole);
    });

    describe('initialization', () => {
        it('should initialize error handler', () => {
            errorHandler.initialize();

            expect(window.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
            expect(window.addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
        });

        it('should not initialize twice', () => {
            errorHandler.initialize();
            const callCount = window.addEventListener.mock.calls.length;

            errorHandler.initialize();

            expect(window.addEventListener.mock.calls.length).toBe(callCount);
        });
    });

    describe('error reporting', () => {
        beforeEach(() => {
            errorHandler.initialize();
        });

        it('should report errors manually', () => {
            const error = new Error('Test error');
            const errorId = errorHandler.reportError(error, {
                component: 'TestComponent',
                level: 'error'
            });

            expect(errorId).toMatch(/^err_/);

            const stats = errorHandler.getStats();
            expect(stats.total).toBe(1);
            expect(stats.byComponent.TestComponent).toBe(1);
        });

        it('should report critical errors', () => {
            const error = new Error('Critical error');

            errorHandler.reportCriticalError(error, {
                component: 'CriticalComponent'
            });

            const stats = errorHandler.getStats();
            expect(stats.critical).toBe(1);
            expect(stats.byLevel.critical).toBe(1);
        });

        it('should track error statistics', () => {
            errorHandler.reportError(new Error('Error 1'), { component: 'CompA', level: 'error' });
            errorHandler.reportError(new Error('Error 2'), { component: 'CompA', level: 'warning' });
            errorHandler.reportError(new Error('Error 3'), { component: 'CompB', level: 'error' });

            const stats = errorHandler.getStats();

            expect(stats.total).toBe(3);
            expect(stats.byComponent.CompA).toBe(2);
            expect(stats.byComponent.CompB).toBe(1);
            expect(stats.byLevel.error).toBe(2);
            expect(stats.byLevel.warning).toBe(1);
        });

        it('should maintain error history limit', () => {
            // Set a low limit for testing
            errorHandler.maxErrors = 3;

            for (let i = 0; i < 5; i++) {
                errorHandler.reportError(new Error(`Error ${i}`));
            }

            const recentErrors = errorHandler.getRecentErrors();
            expect(recentErrors.length).toBe(3);
        });
    });

    describe('error handlers', () => {
        beforeEach(() => {
            errorHandler.initialize();
        });

        it('should register custom error handlers', () => {
            const handler = vi.fn();

            errorHandler.registerHandler('custom_error', handler);
            errorHandler.reportError(new Error('Test'), { type: 'custom_error' });

            expect(handler).toHaveBeenCalled();
        });

        it('should execute multiple handlers for same error type', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            errorHandler.registerHandler('test_error', handler1);
            errorHandler.registerHandler('test_error', handler2);
            errorHandler.reportError(new Error('Test'), { type: 'test_error' });

            expect(handler1).toHaveBeenCalled();
            expect(handler2).toHaveBeenCalled();
        });

        it('should handle handler errors gracefully', () => {
            const failingHandler = () => {
                throw new Error('Handler failed');
            };

            errorHandler.registerHandler('test_error', failingHandler);

            expect(() => {
                errorHandler.reportError(new Error('Test'), { type: 'test_error' });
            }).not.toThrow();
        });
    });

    describe('function wrapping', () => {
        beforeEach(() => {
            errorHandler.initialize();
        });

        it('should wrap synchronous functions', () => {
            const fn = () => {
                throw new Error('Wrapped error');
            };

            const wrapped = errorHandler.wrapFunction(fn, { component: 'TestComponent' });

            expect(() => wrapped()).toThrow('Wrapped error');

            const stats = errorHandler.getStats();
            expect(stats.total).toBe(1);
        });

        it('should wrap asynchronous functions', async () => {
            const fn = async () => {
                throw new Error('Async error');
            };

            const wrapped = errorHandler.wrapFunction(fn, { component: 'AsyncComponent' });

            await expect(wrapped()).rejects.toThrow('Async error');

            const stats = errorHandler.getStats();
            expect(stats.total).toBe(1);
        });

        it('should preserve function return values', () => {
            const fn = () => 'success';
            const wrapped = errorHandler.wrapFunction(fn);

            expect(wrapped()).toBe('success');
        });
    });

    describe('error boundaries', () => {
        beforeEach(() => {
            errorHandler.initialize();
        });

        it('should create error boundaries', () => {
            const render = () => {
                throw new Error('Render error');
            };
            const fallback = () => '<div>Error occurred</div>';

            const boundary = errorHandler.createErrorBoundary(render, fallback, {
                component: 'TestBoundary'
            });

            const result = boundary();
            expect(result).toBe('<div>Error occurred</div>');

            const stats = errorHandler.getStats();
            expect(stats.total).toBe(1);
        });

        it('should handle fallback errors', () => {
            const render = () => {
                throw new Error('Render error');
            };
            const fallback = () => {
                throw new Error('Fallback error');
            };

            const boundary = errorHandler.createErrorBoundary(render, fallback);

            const result = boundary();
            expect(result).toBe('<div>Critical error occurred</div>');

            const stats = errorHandler.getStats();
            expect(stats.critical).toBe(1);
        });
    });

    describe('user notification', () => {
        beforeEach(() => {
            errorHandler.initialize();
        });

        it('should notify user of critical errors', () => {
            const error = {
                level: 'critical',
                message: 'Critical error occurred',
                id: 'test-error-1'
            };

            errorHandler.notifyUser(error);

            expect(window.alert).toHaveBeenCalledWith(
                expect.stringContaining('Critical Error: Critical error occurred')
            );
        });

        it('should notify user of regular errors', () => {
            const error = {
                level: 'error',
                message: 'Regular error occurred',
                id: 'test-error-2'
            };

            errorHandler.notifyUser(error);

            expect(window.alert).toHaveBeenCalledWith(
                'Error: Regular error occurred'
            );
        });
    });

    describe('error reporting to server', () => {
        beforeEach(() => {
            errorHandler.initialize();
        });

        it('should send error reports to server', async () => {
            fetch.mockResolvedValueOnce({ ok: true });

            const error = {
                id: 'test-error',
                message: 'Test error',
                level: 'error',
                type: 'test',
                component: 'test'
            };

            await errorHandler.sendErrorReport(error);

            expect(fetch).toHaveBeenCalledWith('/api/errors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: expect.stringContaining('test-error')
            });
        });

        it('should handle failed error reports', async () => {
            fetch.mockRejectedValueOnce(new Error('Network error'));

            const error = {
                id: 'test-error',
                message: 'Test error'
            };

            await expect(errorHandler.sendErrorReport(error)).resolves.not.toThrow();
        });
    });

    describe('comprehensive reporting', () => {
        beforeEach(() => {
            errorHandler.initialize();
        });

        it('should generate comprehensive reports', () => {
            errorHandler.reportError(new Error('Test 1'), { component: 'Comp1' });
            errorHandler.reportError(new Error('Test 2'), { component: 'Comp2' });

            const report = errorHandler.generateReport();

            expect(report).toHaveProperty('sessionId');
            expect(report).toHaveProperty('timestamp');
            expect(report).toHaveProperty('stats');
            expect(report).toHaveProperty('recentErrors');
            expect(report).toHaveProperty('systemInfo');

            expect(report.stats.total).toBe(2);
            expect(report.recentErrors).toHaveLength(2);
        });
    });

    describe('error filtering and querying', () => {
        beforeEach(() => {
            errorHandler.initialize();
        });

        it('should get errors by type', () => {
            errorHandler.reportError(new Error('Error 1'), { type: 'type_a' });
            errorHandler.reportError(new Error('Error 2'), { type: 'type_b' });
            errorHandler.reportError(new Error('Error 3'), { type: 'type_a' });

            const typeAErrors = errorHandler.getErrorsByType('type_a');

            expect(typeAErrors).toHaveLength(2);
            typeAErrors.forEach(error => {
                expect(error.type).toBe('type_a');
            });
        });

        it('should get recent errors with limit', () => {
            for (let i = 0; i < 10; i++) {
                errorHandler.reportError(new Error(`Error ${i}`));
            }

            const recentErrors = errorHandler.getRecentErrors(3);

            expect(recentErrors).toHaveLength(3);
            // Should get the most recent ones
            expect(recentErrors[2].message).toBe('Error 9');
        });
    });
});