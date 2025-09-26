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

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url} from ${req.get('User-Agent')?.substring(0, 50) || 'Unknown'}`);
  next();
});

app.use(express.json({ limit: config.api.requestLimit }));
app.use(express.urlencoded({ extended: true, limit: config.api.requestLimit }));

// Configure session middleware with custom store for Vercel
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'dev-session-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true, // Create session even if not modified (needed for Vercel)
  proxy: true, // Trust proxy for Vercel
  name: 'sessionId', // Explicit session name
  cookie: {
    secure: isProduction, // Use secure cookies in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax', // Less restrictive for cross-origin scenarios
    domain: isProduction ? undefined : 'localhost' // Let browser handle domain in production
  }
};

// For Vercel, temporarily disable database session store due to configuration issues
if (false && isVercel) { // Disable database sessions for now
  console.log('[SESSION] Database session store disabled - using memory store on Vercel');

  // Simple session store that uses the database
  class DatabaseSessionStore extends session.Store {
    constructor() {
      super();
      this.prefix = 'sess:';
    }

    async get(sid, callback) {
      try {
        console.log('[SESSION_STORE] Getting session:', sid);
        const { prisma } = await import('./lib/prisma.js');

        // Check if prisma is available
        if (!prisma) {
          console.log('[SESSION_STORE] Prisma not available, returning null session');
          callback(null, null);
          return;
        }

        // Find session in database
        const session = await prisma.session.findUnique({
          where: { sid }
        });

        if (session && session.expiresAt > new Date()) {
          console.log('[SESSION_STORE] Session found in database');
          callback(null, JSON.parse(session.data));
          return;
        }

        console.log('[SESSION_STORE] Session not found or expired');
        callback(null, null);
      } catch (error) {
        console.error('[SESSION_STORE] Error getting session, falling back to no session:', error.message);
        // Don't pass error to callback - just return null session to allow app to continue
        callback(null, null);
      }
    }

    async set(sid, sessionData, callback) {
      try {
        console.log('[SESSION_STORE] Setting session:', sid, 'data:', sessionData);
        const { prisma } = await import('./lib/prisma.js');

        // Check if prisma is available
        if (!prisma) {
          console.log('[SESSION_STORE] Prisma not available, skipping session save');
          callback(null);
          return;
        }

        // Store session in database
        const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours

        await prisma.session.upsert({
          where: { sid },
          update: {
            data: JSON.stringify(sessionData),
            expiresAt
          },
          create: {
            sid,
            data: JSON.stringify(sessionData),
            expiresAt
          }
        });

        callback(null);
      } catch (error) {
        console.error('[SESSION_STORE] Error setting session, continuing without session save:', error.message);
        // Don't pass error - allow app to continue without session persistence
        callback(null);
      }
    }

    async destroy(sid, callback) {
      try {
        console.log('[SESSION_STORE] Destroying session:', sid);
        const { prisma } = await import('./lib/prisma.js');

        if (!prisma) {
          console.log('[SESSION_STORE] Prisma not available, skipping session destroy');
          callback(null);
          return;
        }

        // Delete session from database
        await prisma.session.deleteMany({
          where: { sid }
        });

        callback(null);
      } catch (error) {
        console.error('[SESSION_STORE] Error destroying session, continuing:', error.message);
        // Don't pass error - allow app to continue
        callback(null);
      }
    }
  }

  sessionConfig.store = new DatabaseSessionStore();
} else {
  console.log('[SESSION] Using memory store for local development');
}

app.use(session(sessionConfig));

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
// console.log("[DEBUG] Force restart to pick up controller changes");

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
  const server = app.listen(config.server.port, () => {
    console.log("\n=== SERVER SUCCESSFULLY STARTED (MODULAR) ===\n");
    console.log(`🌐 Grader running on http://localhost:${config.server.port}`);
    console.log("📝 Submit essays to see grading logs here");
    console.log("⚡ Using modular architecture");
    console.log("📁 Routes organized by feature\n");
  });

  // Keep the process alive and handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
} else {
  console.log("🚀 Configured for Vercel serverless deployment (modular)");
}

// Export for Vercel serverless functions
export default app;