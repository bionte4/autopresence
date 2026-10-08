import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditPayload } from "./canonical";

type Db = PrismaClient | Prisma.TransactionClient;

export async function lockAuditChain(db: Db): Promise<void> {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(872341)`;
}

export async function latestHash(db: Db): Promise<string | null> {
  const last = await db.auditLog.findFirst({
    orderBy: { id: "desc" },
    select: { hash: true },
  });
  return last?.hash ?? null;
}

export async function insertAudit(
  db: Db,
  input: {
    payload: AuditPayload;
    prevHash: string;
    hash: string;
    createdAt: Date;
  },
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: input.payload.actorId,
      action: input.payload.action,
      entity: input.payload.entity,
      entityId: input.payload.entityId,
      diff: input.payload.diff === null ? Prisma.DbNull : (input.payload.diff as Prisma.InputJsonValue),
      ip: input.payload.ip,
      createdAt: input.createdAt,
      prevHash: input.prevHash,
      hash: input.hash,
    },
  });
}

export async function listAudit(query: { page: number; pageSize: number; direction: "asc" | "desc" }) {
  const where = {};
  const [total, rows] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { id: query.direction },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { total, rows };
}

export async function listAuditChain() {
  return prisma.auditLog.findMany({ orderBy: { id: "asc" } });
}
