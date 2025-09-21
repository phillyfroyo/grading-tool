/**
 * Jest Configuration for Backend Testing
 *
 * Configured for Node.js ES modules with comprehensive testing capabilities
 * including unit tests, integration tests, and coverage reporting.
 */

export default {
  // Environment
  testEnvironment: 'node',

  // ES Modules support
  preset: undefined,
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  // Test configuration
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],

  testPathIgnorePatterns: [
    '/node_modules/',
    '/public/',
    '/tests/e2e/',
    '/tests/frontend/'
  ],

  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],
  globalSetup: '<rootDir>/tests/setup/jest.global-setup.js',
  globalTeardown: '<rootDir>/tests/setup/jest.global-teardown.js',

  // Coverage configuration
  collectCoverage: false, // Enable with --coverage flag
  collectCoverageFrom: [
    'src/**/*.js',
    'server.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],

  coverageDirectory: 'coverage/backend',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],

  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Timeouts
  testTimeout: 10000,

  // Error handling
  errorOnDeprecated: true,
  verbose: true,

  // Module resolution
  moduleDirectories: ['node_modules', '<rootDir>'],
  modulePaths: ['<rootDir>'],

  // Test results
  reporters: ['default'],

  // Mocking
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,

  // Watch mode
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/public/'
  ]
};