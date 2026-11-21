import { PrismaClient } from '@prisma/client';

export const isDbConfigured = Boolean(
  process.env.DATABASE_URL &&
    (process.env.DATABASE_URL.startsWith('postgresql://') ||
      process.env.DATABASE_URL.startsWith('postgres://'))
);

let prismaInstance: PrismaClient | null = null;

if (isDbConfigured) {
  try {
    prismaInstance = new PrismaClient();
  } catch (e) {
    console.warn('Failed to initialize Prisma client:', e);
    prismaInstance = null;
  }
}

export const prisma = prismaInstance as PrismaClient;
