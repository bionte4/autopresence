import { createHash } from "node:crypto";

export const AUDIT_GENESIS = "0".repeat(64);

export type AuditPayload = {
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  diff: unknown;
  ip: string | null;
  createdAt: string;
};

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Non-finite number cannot be stored in an audit payload.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  throw new Error("Unsupported value in audit payload.");
}

export function chainHash(prevHash: string, payload: AuditPayload): string {
  return createHash("sha256").update(prevHash + canonicalJson(payload), "utf8").digest("hex");
}

export type ChainRow = AuditPayload & { id: bigint; prevHash: string; hash: string };

export type VerifyResult = {
  valid: boolean;
  checked: number;
  brokenAtId: string | null;
};

export function verifyRows(rows: ChainRow[]): VerifyResult {
  let prev = AUDIT_GENESIS;
  let checked = 0;
  for (const row of rows) {
    const payload: AuditPayload = {
      actorId: row.actorId,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      diff: row.diff,
      ip: row.ip,
      createdAt: row.createdAt,
    };
    const expected = chainHash(prev, payload);
    if (row.prevHash !== prev || row.hash !== expected) {
      return { valid: false, checked, brokenAtId: row.id.toString() };
    }
    prev = row.hash;
    checked += 1;
  }
  return { valid: true, checked, brokenAtId: null };
}
