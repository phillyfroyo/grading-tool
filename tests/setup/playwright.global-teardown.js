/**
 * Playwright Global Teardown - E2E Testing
 *
 * Runs once after all Playwright tests. Cleans up test environment,
 * test data, and closes test server.
 */

async function globalTeardown(config) {
  console.log('[E2E TEARDOWN] Starting Playwright global teardown...');

  try {
    // Clean up test data
    console.log('[E2E TEARDOWN] Cleaning up test data...');
    // In a real implementation, you might:
    // 1. Delete test user accounts
    // 2. Clean up test files
    // 3. Reset database state
    // 4. Clear uploaded files

    // Clean up global configuration
    delete global.__E2E_CONFIG__;

    console.log('[E2E TEARDOWN] Playwright global teardown completed successfully');
  } catch (error) {
    console.error('[E2E TEARDOWN] Failed to cleanup E2E environment:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}

module.exports = globalTeardown;