// Application configuration module
// Centralizes environment detection and configuration management

import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Environment detection
const isVercel = process.env.VERCEL === '1';
const isProduction = process.env.NODE_ENV === 'production';

console.log(`[ENV] Running in: ${isVercel ? 'Vercel' : 'Local'} environment`);

// Application configuration
const config = {
  environment: {
    isVercel,
    isProduction,
    nodeEnv: process.env.NODE_ENV || 'development',
    platform: process.platform,
    nodeVersion: process.version
  },
  server: {
    port: process.env.PORT || 3001,
    host: process.env.HOST || 'localhost'
  },
  api: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    requestLimit: '10mb'
  },
  files: {
    profilesPath: './class-profiles.json',
    publicPath: 'public'
  },
  logging: {
    enableMorgan: false, // Set to true to enable HTTP request logging
    enableHeartbeat: false // Set to true to enable periodic heartbeat logs
  }
};

// Validation
function validateConfig() {
  const errors = [];

  if (!config.api.openaiApiKey && !config.api.anthropicApiKey) {
    errors.push('Either OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable is required');
  }

  if (errors.length > 0) {
    console.warn('⚠️ Configuration warnings:', errors);
  }

  return errors.length === 0;
}

// Log configuration on startup
console.log("[CONFIG] Application configuration loaded:");
console.log(`  - Environment: ${config.environment.isVercel ? 'Vercel' : 'Local'}`);
console.log(`  - Node.js: ${config.environment.nodeVersion}`);
console.log(`  - Platform: ${config.environment.platform}`);
console.log(`  - OpenAI API Key: ${config.api.openaiApiKey ? 'Present' : 'Missing'}`);
console.log(`  - Anthropic API Key: ${config.api.anthropicApiKey ? 'Present' : 'Missing'}`);

export {
  config,
  validateConfig,
  isVercel,
  isProduction
};