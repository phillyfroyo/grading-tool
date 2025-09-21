// Database configuration module
// Handles Prisma initialization and database connection management

console.log("[DATABASE] Initializing database configuration...");

let prisma = null;
let useDatabase = false;

// Initialize database connection
async function initializeDatabase() {
  try {
    const { prisma: prismaClient } = await import("../../lib/prisma.js");
    prisma = prismaClient;
    useDatabase = true;
    console.log("✅ Prisma database connected");
    return { prisma, useDatabase: true };
  } catch (error) {
    console.warn("⚠️ Database unavailable, using file storage:", error.message);
    return { prisma: null, useDatabase: false };
  }
}

// Get current database configuration
function getDatabaseConfig() {
  return {
    prisma,
    useDatabase,
    isInitialized: prisma !== null || useDatabase === false
  };
}

export {
  initializeDatabase,
  getDatabaseConfig,
  prisma,
  useDatabase
};