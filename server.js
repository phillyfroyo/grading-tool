// server-modular.js
// Streamlined server using modular architecture

console.log("\n=== ESL GRADING SERVER STARTING (MODULAR) ===\n");
console.log("[BOOT] import:", import.meta.url);
console.log("[BOOT] cwd:", process.cwd());
console.log("[BOOT] Node version:", process.version);
console.log("[BOOT] Platform:", process.platform);

import express from "express";
import compression from "compression";
import morgan from "morgan";
import session from "express-session";
import cookieParser from "cookie-parser";
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

// Gzip responses. This is the fix for Vercel FUNCTION_PAYLOAD_TOO_LARGE (413)
// on GET /api/grading-session: a saved session blob (all essays' rendered HTML
// across tabs) can exceed Vercel's ~4.5MB function-response limit. gzip shrinks
// that JSON ~7x (rendered HTML is highly repetitive), giving large headroom.
//
// CRITICAL: must NOT compress Server-Sent Events (the grading stream). Buffering
// an event-stream would delay/break live grading. The filter below explicitly
// skips any response whose Content-Type is text/event-stream, then falls back
// to compression's default filter for everything else.
app.use(compression({
  filter: (req, res) => {
    const type = res.getHeader('Content-Type');
    if (typeof type === 'string' && type.includes('text/event-stream')) {
      return false; // never compress SSE / live grading streams
    }
    return compression.filter(req, res);
  },
}));

app.use(express.json({ limit: config.api.requestLimit }));
app.use(express.urlencoded({ extended: true, limit: config.api.requestLimit }));

// Add cookie parser with signing secret
app.use(cookieParser(process.env.SESSION_SECRET || 'dev-session-secret-key-change-in-production'));

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

// Database-backed session store.
//
// Why this exists: on Vercel (serverless), express-session's default
// MemoryStore does NOT persist across function invocations — each instance
// has its own memory — so req.session is unreliable and auth silently lapses
// mid-session (observed in prod as autosave 401s). A DB-backed store fixes
// that by persisting sessions in Postgres so any instance can read them.
//
// Gated + reversible: strictly opt-in via USE_DB_SESSION_STORE=1, AND only
// after the store initializes successfully. If anything goes wrong (no prisma,
// DB error), we fall back to MemoryStore rather than risk locking users out.
// Until the flag is set (e.g. in Vercel env), behavior is unchanged. Unset or
// flip to anything but '1' to force MemoryStore — no code redeploy needed.
const wantDbSessionStore = process.env.USE_DB_SESSION_STORE === '1';

if (wantDbSessionStore) {
  class DatabaseSessionStore extends session.Store {
    async get(sid, callback) {
      try {
        const { prisma } = await import('./lib/prisma.js');
        if (!prisma) return callback(null, null);
        // NOTE: the Prisma model is `sessions` (plural) → client accessor is
        // prisma.sessions. The previous (disabled) version used prisma.session
        // which is undefined — that was the bug that got this store shelved.
        const row = await prisma.sessions.findUnique({ where: { sid } });
        if (row && row.expiresAt > new Date()) {
          return callback(null, JSON.parse(row.data));
        }
        return callback(null, null);
      } catch (error) {
        console.error('[SESSION_STORE] get error (returning no session):', error.message);
        callback(null, null);
      }
    }

    async set(sid, sessionData, callback) {
      try {
        const { prisma } = await import('./lib/prisma.js');
        if (!prisma) return callback(null);
        // Prefer the cookie's own expiry so DB rows expire in lockstep with
        // the cookie; fall back to 24h.
        const cookieMaxAge = sessionData?.cookie?.maxAge;
        const expiresAt = new Date(Date.now() + (cookieMaxAge || 24 * 60 * 60 * 1000));
        const data = JSON.stringify(sessionData);
        await prisma.sessions.upsert({
          where: { sid },
          update: { data, expiresAt },
          // id + updatedAt are filled by Prisma defaults (@default(cuid()),
          // @updatedAt) — see schema. Only sid/data/expiresAt are required.
          create: { sid, data, expiresAt },
        });
        callback(null);
      } catch (error) {
        console.error('[SESSION_STORE] set error (continuing without persist):', error.message);
        callback(null);
      }
    }

    async destroy(sid, callback) {
      try {
        const { prisma } = await import('./lib/prisma.js');
        if (!prisma) return callback(null);
        await prisma.sessions.deleteMany({ where: { sid } });
        callback(null);
      } catch (error) {
        console.error('[SESSION_STORE] destroy error (continuing):', error.message);
        callback(null);
      }
    }

    // express-session calls touch() to refresh expiry on active sessions.
    // Without it, rolling sessions would not extend their DB expiry.
    async touch(sid, sessionData, callback) {
      try {
        const { prisma } = await import('./lib/prisma.js');
        if (!prisma) return callback && callback(null);
        const cookieMaxAge = sessionData?.cookie?.maxAge;
        const expiresAt = new Date(Date.now() + (cookieMaxAge || 24 * 60 * 60 * 1000));
        await prisma.sessions.updateMany({ where: { sid }, data: { expiresAt } });
        callback && callback(null);
      } catch (error) {
        // touch failures are non-fatal — the session still exists.
        callback && callback(null);
      }
    }
  }

  try {
    sessionConfig.store = new DatabaseSessionStore();
    console.log('[SESSION] Using database-backed session store (persists across serverless instances)');
  } catch (error) {
    console.error('[SESSION] Failed to init DB session store — falling back to memory store:', error.message);
  }
} else {
  console.log('[SESSION] Using memory store (set USE_DB_SESSION_STORE=1 to enable DB-backed sessions)');
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

    // Set caching headers for static assets (24 hours)
    if (path.endsWith('.css') || path.endsWith('.js') || path.endsWith('.svg') || path.endsWith('.png')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
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