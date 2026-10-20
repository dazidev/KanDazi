import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export function getPrisma() {
  if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL en .env para conectar PostgreSQL.');
  if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DATABASE_POOL_SIZE ?? 10) }) });
  return globalForPrisma.prisma;
}
