// lib/prisma.js
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

let prisma;

try {
  // Check if DATABASE_URL is available
  console.log('[PRISMA] =================================');
  console.log('[PRISMA] Environment check:');
  console.log('[PRISMA] NODE_ENV:', process.env.NODE_ENV);
  console.log('[PRISMA] DATABASE_URL exists:', !!process.env.DATABASE_URL);
  console.log('[PRISMA] DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);
  console.log('[PRISMA] DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 20) || 'N/A');
  console.log('[PRISMA] =================================');

  if (!process.env.DATABASE_URL) {
    console.warn('[PRISMA] DATABASE_URL not found - Prisma client will be disabled');
    prisma = null;
  } else {
    console.log('[PRISMA] DATABASE_URL found, initializing client...');

    prisma = globalForPrisma.prisma || new PrismaClient({
      log: ['info', 'warn', 'error'], // More verbose logging
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });

    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = prisma;
    }

    console.log('[PRISMA] ✅ Client initialized successfully');

    // Test connection asynchronously (don't block initialization)
    prisma.$connect()
      .then(() => {
        console.log('[PRISMA] ✅ Connection test successful!');
      })
      .catch((connectionError) => {
        console.error('[PRISMA] ❌ Connection test failed:', connectionError.message);
      });
  }
} catch (error) {
  console.error('[PRISMA] Failed to initialize client:', error.message);
  console.error('[PRISMA] Full error:', error);
  prisma = null;
}

export { prisma };