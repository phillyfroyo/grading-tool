/**
 * Jest Global Setup - Backend Testing
 *
 * Runs once before all Jest tests. Sets up test database,
 * test server, and global test environment.
 */

export default async function globalSetup() {
  console.log('[GLOBAL SETUP] Starting Jest global setup...');

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'file:./test.db';
  process.env.OPENAI_API_KEY = 'test-api-key';
  process.env.PORT = '3001';

  try {
    // Initialize test database
    console.log('[GLOBAL SETUP] Initializing test database...');

    // Note: In a real implementation, you would:
    // 1. Create a separate test database
    // 2. Run migrations
    // 3. Seed with test data
    // For now, we'll use mocks

    // Store configuration for tests
    global.__TEST_CONFIG__ = {
      databaseUrl: process.env.DATABASE_URL,
      apiPort: process.env.PORT,
      openaiApiKey: process.env.OPENAI_API_KEY
    };

    console.log('[GLOBAL SETUP] Jest global setup completed successfully');
  } catch (error) {
    console.error('[GLOBAL SETUP] Failed to setup test environment:', error);
    throw error;
  }
}