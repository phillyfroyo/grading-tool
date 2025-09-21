/**
 * Dependency Container Tests
 * Tests for the dependency injection container
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import container from '../../../public/js/core/dependency-container.js';

describe('DependencyContainer', () => {
    beforeEach(() => {
        container.clear();
    });

    describe('service registration', () => {
        it('should register a service factory', () => {
            const factory = () => ({ value: 'test' });

            container.register('testService', factory);

            expect(container.has('testService')).toBe(true);
        });

        it('should register services with dependencies', () => {
            const depFactory = () => ({ dep: true });
            const mainFactory = (dep) => ({ main: true, dep });

            container.register('dependency', depFactory);
            container.register('mainService', mainFactory, ['dependency']);

            const service = container.get('mainService');
            expect(service.main).toBe(true);
            expect(service.dep.dep).toBe(true);
        });

        it('should register singleton instances', () => {
            const instance = { value: 'singleton' };

            container.registerInstance('singletonService', instance);

            const retrieved1 = container.get('singletonService');
            const retrieved2 = container.get('singletonService');

            expect(retrieved1).toBe(instance);
            expect(retrieved2).toBe(instance);
            expect(retrieved1).toBe(retrieved2);
        });
    });

    describe('service resolution', () => {
        it('should create singleton instances by default', () => {
            const factory = () => ({ value: Math.random() });

            container.register('singletonTest', factory);

            const instance1 = container.get('singletonTest');
            const instance2 = container.get('singletonTest');

            expect(instance1).toBe(instance2);
        });

        it('should resolve dependencies in correct order', () => {
            const calls = [];

            const depA = () => {
                calls.push('depA');
                return { name: 'depA' };
            };

            const depB = (a) => {
                calls.push('depB');
                return { name: 'depB', depA: a };
            };

            const main = (a, b) => {
                calls.push('main');
                return { name: 'main', depA: a, depB: b };
            };

            container.register('depA', depA);
            container.register('depB', depB, ['depA']);
            container.register('main', main, ['depA', 'depB']);

            const result = container.get('main');

            expect(calls).toEqual(['depA', 'depB', 'main']);
            expect(result.name).toBe('main');
            expect(result.depA.name).toBe('depA');
            expect(result.depB.name).toBe('depB');
        });

        it('should throw error for missing dependencies', () => {
            const factory = (missing) => ({ missing });

            container.register('testService', factory, ['missingDep']);

            expect(() => container.get('testService')).toThrow();
        });

        it('should fallback to global services', () => {
            // Mock global service
            global.window = { testGlobal: { value: 'global' } };

            const service = container.get('testGlobal');
            expect(service.value).toBe('global');
        });
    });

    describe('dependency validation', () => {
        it('should validate all dependencies can be resolved', () => {
            container.register('service1', () => ({}), ['service2']);
            container.register('service2', () => ({}));

            const validation = container.validateDependencies();

            expect(validation.valid).toBe(true);
            expect(validation.missing).toHaveLength(0);
        });

        it('should detect missing dependencies', () => {
            container.register('service1', () => ({}), ['missing']);

            const validation = container.validateDependencies();

            expect(validation.valid).toBe(false);
            expect(validation.missing).toHaveLength(1);
            expect(validation.missing[0]).toEqual({
                service: 'service1',
                dependency: 'missing'
            });
        });

        it('should detect circular dependencies', () => {
            container.register('service1', () => ({}), ['service2']);
            container.register('service2', () => ({}), ['service1']);

            const validation = container.validateDependencies();

            expect(validation.valid).toBe(false);
            expect(validation.circular.length).toBeGreaterThan(0);
        });
    });

    describe('initialization', () => {
        it('should initialize all services', async () => {
            const initSpy1 = vi.fn();
            const initSpy2 = vi.fn();

            const service1 = { initialize: initSpy1 };
            const service2 = { initialize: initSpy2 };

            container.registerInstance('service1', service1);
            container.registerInstance('service2', service2);

            await container.initializeAll();

            expect(initSpy1).toHaveBeenCalled();
            expect(initSpy2).toHaveBeenCalled();
        });

        it('should handle initialization errors gracefully', async () => {
            const errorService = {
                initialize: () => {
                    throw new Error('Init failed');
                }
            };

            container.registerInstance('errorService', errorService);

            const result = await container.initializeAll();

            expect(result.failed).toHaveLength(1);
            expect(result.failed[0].name).toBe('errorService');
        });
    });

    describe('scoping', () => {
        it('should create scoped containers', () => {
            container.register('service1', () => ({ value: 'original' }));

            const scope = container.createScope();
            scope.register('service2', () => ({ value: 'scoped' }));

            expect(container.has('service1')).toBe(true);
            expect(container.has('service2')).toBe(false);
            expect(scope.has('service1')).toBe(true);
            expect(scope.has('service2')).toBe(true);
        });
    });

    describe('service management', () => {
        it('should remove services', () => {
            container.register('testService', () => ({}));

            expect(container.has('testService')).toBe(true);

            container.remove('testService');

            expect(container.has('testService')).toBe(false);
        });

        it('should get service names', () => {
            container.register('service1', () => ({}));
            container.register('service2', () => ({}));

            const names = container.getServiceNames();

            expect(names).toContain('service1');
            expect(names).toContain('service2');
        });

        it('should get dependency graph', () => {
            container.register('service1', () => ({}), ['service2']);
            container.register('service2', () => ({}));

            const graph = container.getDependencyGraph();

            expect(graph.service1).toEqual(['service2']);
            expect(graph.service2).toEqual([]);
        });
    });
});