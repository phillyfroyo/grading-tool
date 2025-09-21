/**
 * Unit Tests for Dependency Injection Container
 *
 * Tests the DI container functionality including:
 * - Service registration
 * - Dependency resolution
 * - Lifecycle management
 * - Error handling
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Container, SERVICE_LIFETIME, getGlobalContainer, setGlobalContainer } from '../../../../src/core/Container.js';

describe('Container', () => {
  let container;

  beforeEach(() => {
    container = new Container();
  });

  afterEach(() => {
    if (container) {
      container.dispose();
    }
  });

  describe('Service Registration', () => {
    it('should register a service with default options', () => {
      class TestService {}

      const result = container.register('testService', TestService);

      expect(result).toBe(container); // Should return self for chaining
      expect(container.hasService('testService')).toBe(true);

      const serviceInfo = container.getServiceInfo('testService');
      expect(serviceInfo).toEqual({
        name: 'testService',
        dependencies: [],
        lifetime: SERVICE_LIFETIME.SINGLETON,
        isFactory: false,
        hasInstance: false
      });
    });

    it('should register a service with dependencies', () => {
      class Logger {}
      class UserService {}

      container.register('logger', Logger);
      container.register('userService', UserService, {
        dependencies: ['logger'],
        lifetime: SERVICE_LIFETIME.TRANSIENT
      });

      const serviceInfo = container.getServiceInfo('userService');
      expect(serviceInfo.dependencies).toEqual(['logger']);
      expect(serviceInfo.lifetime).toBe(SERVICE_LIFETIME.TRANSIENT);
    });

    it('should register singleton service using convenience method', () => {
      class TestService {}

      container.registerSingleton('testService', TestService, ['dependency']);

      const serviceInfo = container.getServiceInfo('testService');
      expect(serviceInfo.lifetime).toBe(SERVICE_LIFETIME.SINGLETON);
      expect(serviceInfo.dependencies).toEqual(['dependency']);
    });

    it('should register transient service using convenience method', () => {
      class TestService {}

      container.registerTransient('testService', TestService, ['dependency']);

      const serviceInfo = container.getServiceInfo('testService');
      expect(serviceInfo.lifetime).toBe(SERVICE_LIFETIME.TRANSIENT);
    });

    it('should register factory function', () => {
      const factory = () => ({ value: 'test' });

      container.registerFactory('testService', factory, {
        lifetime: SERVICE_LIFETIME.SINGLETON
      });

      const serviceInfo = container.getServiceInfo('testService');
      expect(serviceInfo.isFactory).toBe(true);
    });

    it('should register existing instance', () => {
      const instance = { value: 'test' };

      container.registerInstance('testService', instance);

      const serviceInfo = container.getServiceInfo('testService');
      expect(serviceInfo.isFactory).toBe(true);
      expect(serviceInfo.hasInstance).toBe(true);
    });

    it('should throw error for invalid service name', () => {
      class TestService {}

      expect(() => container.register('', TestService)).toThrow('Service name must be a non-empty string');
      expect(() => container.register(null, TestService)).toThrow('Service name must be a non-empty string');
    });

    it('should throw error for missing implementation', () => {
      expect(() => container.register('testService', null)).toThrow('Service implementation is required');
      expect(() => container.register('testService', undefined)).toThrow('Service implementation is required');
    });

    it('should throw error for invalid lifetime', () => {
      class TestService {}

      expect(() => container.register('testService', TestService, {
        lifetime: 'invalid'
      })).toThrow('Invalid service lifetime: invalid');
    });

    it('should throw error for invalid dependencies', () => {
      class TestService {}

      expect(() => container.register('testService', TestService, {
        dependencies: 'not-an-array'
      })).toThrow('Dependencies must be an array');
    });

    it('should throw error when registering after build', () => {
      class TestService {}
      container.build();

      expect(() => container.register('testService', TestService))
        .toThrow('Cannot register services after container is built');
    });
  });

  describe('Dependency Resolution', () => {
    beforeEach(() => {
      // Set up test services
      class Logger {
        log(message) {
          return `LOG: ${message}`;
        }
      }

      class Database {
        constructor(logger) {
          this.logger = logger;
        }

        query(sql) {
          this.logger.log(`Executing: ${sql}`);
          return { results: [] };
        }
      }

      class UserService {
        constructor(database, logger) {
          this.database = database;
          this.logger = logger;
        }

        findUser(id) {
          this.logger.log(`Finding user ${id}`);
          return this.database.query(`SELECT * FROM users WHERE id = ${id}`);
        }
      }

      container.register('logger', Logger);
      container.register('database', Database, { dependencies: ['logger'] });
      container.register('userService', UserService, { dependencies: ['database', 'logger'] });
    });

    it('should resolve service without dependencies', () => {
      container.build();

      const logger = container.resolve('logger');

      expect(logger).toBeDefined();
      expect(logger.log).toBeDefined();
      expect(logger.log('test')).toBe('LOG: test');
    });

    it('should resolve service with dependencies', () => {
      container.build();

      const userService = container.resolve('userService');

      expect(userService).toBeDefined();
      expect(userService.database).toBeDefined();
      expect(userService.logger).toBeDefined();
      expect(userService.findUser).toBeDefined();
    });

    it('should return same instance for singleton services', () => {
      container.build();

      const logger1 = container.resolve('logger');
      const logger2 = container.resolve('logger');

      expect(logger1).toBe(logger2);
    });

    it('should return different instances for transient services', () => {
      class TransientService {}
      container.register('transientService', TransientService, {
        lifetime: SERVICE_LIFETIME.TRANSIENT
      });
      container.build();

      const service1 = container.resolve('transientService');
      const service2 = container.resolve('transientService');

      expect(service1).not.toBe(service2);
      expect(service1.constructor).toBe(service2.constructor);
    });

    it('should resolve factory functions correctly', () => {
      const factory = (logger) => ({
        log: (message) => logger.log(`FACTORY: ${message}`)
      });

      container.registerFactory('factoryService', factory, {
        dependencies: ['logger']
      });
      container.build();

      const service = container.resolve('factoryService');

      expect(service.log).toBeDefined();
      expect(service.log('test')).toBe('LOG: FACTORY: test');
    });

    it('should throw error when resolving unregistered service', () => {
      container.build();

      expect(() => container.resolve('nonExistentService'))
        .toThrow("Service 'nonExistentService' is not registered");
    });

    it('should throw error when resolving before build', () => {
      expect(() => container.resolve('logger'))
        .toThrow('Container must be built before resolving services');
    });

    it('should throw error for invalid service name during resolution', () => {
      container.build();

      expect(() => container.resolve('')).toThrow('Service name must be a non-empty string');
      expect(() => container.resolve(null)).toThrow('Service name must be a non-empty string');
    });
  });

  describe('Dependency Validation', () => {
    it('should validate dependencies during build', () => {
      class UserService {}

      container.register('userService', UserService, {
        dependencies: ['nonExistentService']
      });

      expect(() => container.build())
        .toThrow("Service 'userService' depends on unregistered service 'nonExistentService'");
    });

    it('should detect circular dependencies', () => {
      class ServiceA {}
      class ServiceB {}

      container.register('serviceA', ServiceA, { dependencies: ['serviceB'] });
      container.register('serviceB', ServiceB, { dependencies: ['serviceA'] });

      expect(() => container.build())
        .toThrow("Circular dependency detected starting from service 'serviceA'");
    });

    it('should detect complex circular dependencies', () => {
      class ServiceA {}
      class ServiceB {}
      class ServiceC {}

      container.register('serviceA', ServiceA, { dependencies: ['serviceB'] });
      container.register('serviceB', ServiceB, { dependencies: ['serviceC'] });
      container.register('serviceC', ServiceC, { dependencies: ['serviceA'] });

      expect(() => container.build())
        .toThrow("Circular dependency detected starting from service 'serviceA'");
    });

    it('should detect circular dependencies during resolution', () => {
      class ServiceA {}
      class ServiceB {}

      container.register('serviceA', ServiceA, { dependencies: ['serviceB'] });
      container.register('serviceB', ServiceB, { dependencies: ['serviceA'] });

      // Bypass build validation for this test
      container._isBuilt = true;

      expect(() => container.resolve('serviceA'))
        .toThrow('Circular dependency detected: serviceA -> serviceB -> serviceA');
    });
  });

  describe('Container Management', () => {
    it('should get all service names', () => {
      class ServiceA {}
      class ServiceB {}

      container.register('serviceA', ServiceA);
      container.register('serviceB', ServiceB);

      const serviceNames = container.getServiceNames();

      expect(serviceNames).toContain('serviceA');
      expect(serviceNames).toContain('serviceB');
      expect(serviceNames).toHaveLength(2);
    });

    it('should check if service exists', () => {
      class TestService {}
      container.register('testService', TestService);

      expect(container.hasService('testService')).toBe(true);
      expect(container.hasService('nonExistentService')).toBe(false);
    });

    it('should get service information', () => {
      class TestService {}
      container.register('testService', TestService, {
        dependencies: ['dependency'],
        lifetime: SERVICE_LIFETIME.TRANSIENT
      });

      const serviceInfo = container.getServiceInfo('testService');

      expect(serviceInfo).toEqual({
        name: 'testService',
        dependencies: ['dependency'],
        lifetime: SERVICE_LIFETIME.TRANSIENT,
        isFactory: false,
        hasInstance: false
      });
    });

    it('should return null for non-existent service info', () => {
      const serviceInfo = container.getServiceInfo('nonExistent');
      expect(serviceInfo).toBe(null);
    });

    it('should create child container', () => {
      class TestService {}
      container.register('testService', TestService);

      const child = container.createChild();

      expect(child).toBeInstanceOf(Container);
      expect(child.hasService('testService')).toBe(true);
      expect(child).not.toBe(container);
    });

    it('should dispose container and clean up resources', () => {
      class DisposableService {
        constructor() {
          this.disposed = false;
        }

        dispose() {
          this.disposed = true;
        }
      }

      container.register('disposableService', DisposableService);
      container.build();

      const service = container.resolve('disposableService');
      expect(service.disposed).toBe(false);

      container.dispose();

      expect(service.disposed).toBe(true);
      expect(container.getServiceNames()).toHaveLength(0);
    });

    it('should handle dispose errors gracefully', () => {
      class ProblematicService {
        dispose() {
          throw new Error('Dispose failed');
        }
      }

      container.register('problematicService', ProblematicService);
      container.build();
      container.resolve('problematicService');

      // Should not throw
      expect(() => container.dispose()).not.toThrow();
    });
  });

  describe('Global Container', () => {
    afterEach(() => {
      // Reset global container
      setGlobalContainer(new Container());
    });

    it('should get global container', () => {
      const globalContainer = getGlobalContainer();

      expect(globalContainer).toBeInstanceOf(Container);
    });

    it('should return same global container instance', () => {
      const container1 = getGlobalContainer();
      const container2 = getGlobalContainer();

      expect(container1).toBe(container2);
    });

    it('should set global container', () => {
      const newContainer = new Container();
      setGlobalContainer(newContainer);

      const globalContainer = getGlobalContainer();

      expect(globalContainer).toBe(newContainer);
    });

    it('should throw error when setting invalid global container', () => {
      expect(() => setGlobalContainer({}))
        .toThrow('Global container must be an instance of Container');
    });
  });

  describe('Edge Cases', () => {
    it('should handle services with no constructor', () => {
      const serviceObject = {
        method: () => 'test'
      };

      container.register('serviceObject', serviceObject);
      container.build();

      const resolved = container.resolve('serviceObject');

      expect(resolved).toBe(serviceObject);
    });

    it('should handle primitive values as services', () => {
      container.register('stringService', 'test string');
      container.register('numberService', 42);
      container.register('booleanService', true);
      container.build();

      expect(container.resolve('stringService')).toBe('test string');
      expect(container.resolve('numberService')).toBe(42);
      expect(container.resolve('booleanService')).toBe(true);
    });

    it('should handle async factory functions', async () => {
      const asyncFactory = async () => {
        await global.testUtils.delay(10);
        return { value: 'async result' };
      };

      container.registerFactory('asyncService', asyncFactory);
      container.build();

      const result = container.resolve('asyncService');

      // The container doesn't await factory functions, so this would be a Promise
      expect(result).toBeInstanceOf(Promise);
    });

    it('should handle deeply nested dependencies', () => {
      class ServiceA {}
      class ServiceB {}
      class ServiceC {}
      class ServiceD {}
      class ServiceE {}

      container.register('serviceE', ServiceE);
      container.register('serviceD', ServiceD, { dependencies: ['serviceE'] });
      container.register('serviceC', ServiceC, { dependencies: ['serviceD'] });
      container.register('serviceB', ServiceB, { dependencies: ['serviceC'] });
      container.register('serviceA', ServiceA, { dependencies: ['serviceB'] });

      container.build();

      const serviceA = container.resolve('serviceA');

      expect(serviceA).toBeDefined();
    });
  });
});