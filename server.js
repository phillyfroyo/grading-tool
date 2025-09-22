// server-modular.js
// Streamlined server using modular architecture

console.log("\n=== ESL GRADING SERVER STARTING (MODULAR) ===\n");
console.log("[BOOT] import:", import.meta.url);
console.log("[BOOT] cwd:", process.cwd());
console.log("[BOOT] Node version:", process.version);
console.log("[BOOT] Platform:", process.platform);

import express from "express";
import morgan from "morgan";
import session from "express-session";
import path from "path";
import { config, validateConfig, isVercel, isProduction } from "./src/config/index.js";
import { initializeDatabase } from "./src/config/database.js";
import { errorHandler, notFoundHandler } from "./src/middleware/errorHandler.js";
import routes from "./src/routes/index.js";

// Initialize the Express application
const app = express();

// Apply configuration
console.log("[CONFIG] Validating configuration...");
validateConfig();

// Initialize database connection
console.log("[DATABASE] Initializing database...");
await initializeDatabase();

// Configure middleware
if (config.logging.enableMorgan) {
  app.use(morgan("dev"));
}

app.use(express.json({ limit: config.api.requestLimit }));
app.use(express.urlencoded({ extended: true, limit: config.api.requestLimit }));

// Configure session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-session-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  proxy: true, // Trust proxy for Vercel
  cookie: {
    secure: isProduction, // Use secure cookies in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: isProduction ? 'lax' : 'strict' // Allow cookies in production
  }
}));

// Configure static file serving with proper headers and caching
// Only serve non-HTML files statically (CSS, JS, images)
app.use(express.static(config.files.publicPath, {
  index: false, // Disable automatic index.html serving
  extensions: ['css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp'], // Only serve these file types
  setHeaders: (res, path) => {
    // Set proper MIME types for allowed files
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    }

    // Set caching headers for static assets (1 hour for development)
    if (path.endsWith('.css') || path.endsWith('.js') || path.endsWith('.svg') || path.endsWith('.png')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// Mount all routes
console.log("[ROUTES] Mounting application routes...");
console.log("[DEBUG] Force restart to pick up controller changes");

// Routes are handled by the modular router

app.use('/', routes);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Optional heartbeat logging
if (config.logging.enableHeartbeat) {
  setInterval(() => {
    console.log("[tick] server alive -", new Date().toLocaleTimeString());
    console.log("[tick] memory usage:", Math.round(process.memoryUsage().heapUsed / 1024 / 1024), "MB");
  }, 15000);
}

// Start server for local development
// For Vercel serverless, export the app
if (!isVercel) {
  app.listen(config.server.port, () => {
    console.log("\n=== SERVER SUCCESSFULLY STARTED (MODULAR) ===\n");
    console.log(`🌐 Grader running on http://localhost:${config.server.port}`);
    console.log("📝 Submit essays to see grading logs here");
    console.log("⚡ Using modular architecture");
    console.log("📁 Routes organized by feature\n");
  });
} else {
  console.log("🚀 Configured for Vercel serverless deployment (modular)");
}

// Export for Vercel serverless functions
export default app;