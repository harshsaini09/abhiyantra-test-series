import { PrismaClient } from '@prisma/client';

export const isDbConfigured = Boolean(
  process.env.DATABASE_URL &&
    (process.env.DATABASE_URL.startsWith('postgresql://') ||
      process.env.DATABASE_URL.startsWith('postgres://'))
);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma = isDbConfigured
  ? globalForPrisma.prisma || (globalForPrisma.prisma = createPrismaClient())
  : (null as unknown as PrismaClient);
