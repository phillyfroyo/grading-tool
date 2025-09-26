// lib/prisma.js
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

let prisma;

try {
  // Check if DATABASE_URL is available
  if (!process.env.DATABASE_URL) {
    console.warn('[PRISMA] DATABASE_URL not found - Prisma client will be disabled');
    prisma = null;
  } else {
    prisma = globalForPrisma.prisma || new PrismaClient({
      log: ['error', 'warn'], // Only log errors and warnings in production
    });

    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = prisma;
    }

    console.log('[PRISMA] Client initialized successfully');
  }
} catch (error) {
  console.error('[PRISMA] Failed to initialize client:', error.message);
  prisma = null;
}

export { prisma };