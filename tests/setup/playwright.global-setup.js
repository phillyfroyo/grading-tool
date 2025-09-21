/**
 * Playwright Global Setup - E2E Testing
 *
 * Runs once before all Playwright tests. Sets up test environment,
 * starts test server, and prepares test data.
 */

const { chromium } = require('@playwright/test');

async function globalSetup(config) {
  console.log('[E2E SETUP] Starting Playwright global setup...');

  try {
    // Set environment variables for E2E tests
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';

    // Wait for server to be ready (handled by webServer config)
    console.log('[E2E SETUP] Waiting for test server...');

    // Create a browser instance for setup operations
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Verify server is responding
    const baseURL = config.use.baseURL || 'http://localhost:3000';
    try {
      await page.goto(baseURL, { timeout: 30000 });
      console.log('[E2E SETUP] Test server is responding');
    } catch (error) {
      console.error('[E2E SETUP] Failed to connect to test server:', error);
      throw error;
    }

    // Setup test data if needed
    console.log('[E2E SETUP] Setting up test data...');
    // In a real implementation, you might:
    // 1. Create test user accounts
    // 2. Seed test essays
    // 3. Setup test profiles
    // 4. Clear browser storage

    // Clear any existing data in browser storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await browser.close();

    // Store configuration for tests
    global.__E2E_CONFIG__ = {
      baseURL,
      testDataCreated: true
    };

    console.log('[E2E SETUP] Playwright global setup completed successfully');
  } catch (error) {
    console.error('[E2E SETUP] Failed to setup E2E environment:', error);
    throw error;
  }
}

module.exports = globalSetup;