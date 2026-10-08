import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  AUDIT_GENESIS,
  chainHash,
  verifyRows,
  type AuditPayload,
  type ChainRow,
  type VerifyResult,
} from "./canonical";
import { insertAudit, latestHash, listAudit, listAuditChain, lockAuditChain } from "./repo";

export type AuditInput = {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  diff?: unknown;
  ip?: string | null;
};

export async function audit(input: AuditInput, tx?: Prisma.TransactionClient): Promise<void> {
  const write = async (db: Prisma.TransactionClient) => {
    await lockAuditChain(db);
    const prevHash = (await latestHash(db)) ?? AUDIT_GENESIS;
    const createdAt = new Date();
    const payload: AuditPayload = {
      actorId: input.actorId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      diff: input.diff ?? null,
      ip: input.ip ?? null,
      createdAt: createdAt.toISOString(),
    };
    await insertAudit(db, {
      payload,
      prevHash,
      hash: chainHash(prevHash, payload),
      createdAt,
    });
  };

  if (tx) {
    await write(tx);
    return;
  }
  await prisma.$transaction(write);
}

export type AuditListItem = {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
};

export async function listAuditLog(query: {
  page: number;
  pageSize: number;
  direction: "asc" | "desc";
}): Promise<{ items: AuditListItem[]; page: number; pageSize: number; total: number }> {
  const { total, rows } = await listAudit(query);
  return {
    items: rows.map((row) => ({
      id: row.id.toString(),
      actorId: row.actorId,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      ip: row.ip,
      createdAt: row.createdAt.toISOString(),
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}

export async function verifyAuditChain(): Promise<VerifyResult> {
  const rows = await listAuditChain();
  const chain: ChainRow[] = rows.map((row) => ({
    id: row.id,
    actorId: row.actorId,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    diff: row.diff,
    ip: row.ip,
    createdAt: row.createdAt.toISOString(),
    prevHash: row.prevHash,
    hash: row.hash,
  }));
  return verifyRows(chain);
}
