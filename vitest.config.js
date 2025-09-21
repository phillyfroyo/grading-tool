/**
 * Vitest Configuration for Frontend Testing
 *
 * Configured for browser environment testing with JSDOM,
 * DOM testing utilities, and comprehensive coverage reporting.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Environment
    environment: 'jsdom',

    // Global setup
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.js'],

    // Test file patterns
    include: [
      'tests/frontend/**/*.{test,spec}.{js,ts}',
      'public/js/**/*.{test,spec}.{js,ts}',
      '**/__tests__/**/*.{js,ts}'
    ],

    exclude: [
      'node_modules/**',
      'tests/backend/**',
      'tests/e2e/**',
      'src/**',
      'coverage/**'
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage/frontend',
      include: [
        'public/js/**/*.js'
      ],
      exclude: [
        'public/js/**/*.test.js',
        'public/js/**/*.spec.js',
        'node_modules/**',
        'tests/**'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,

    // Watch options
    watch: true,
    watchExclude: [
      'node_modules/**',
      'coverage/**'
    ],

    // Output
    reporter: ['verbose', 'html'],
    outputFile: {
      html: './coverage/frontend/index.html'
    },

    // Performance
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false
      }
    }
  },

  // Resolve configuration for module imports
  resolve: {
    alias: {
      '@': './public/js',
      '@core': './public/js/core',
      '@ui': './public/js/ui',
      '@essay': './public/js/essay',
      '@grading': './public/js/grading'
    }
  },

  // Define global variables
  define: {
    global: 'globalThis'
  }
});