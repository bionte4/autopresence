import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

export type Db = Prisma.TransactionClient | PrismaClient;

export function transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}

export class UniqueConflict extends Error {}

export function rethrowUnique(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new UniqueConflict(message);
  }
  throw error;
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
