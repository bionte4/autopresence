import { describe, expect, it } from "vitest";
import { AUDIT_GENESIS, chainHash, canonicalJson, verifyRows, type AuditPayload } from "./canonical";

const payload: AuditPayload = {
  actorId: "user-1",
  action: "auth.login.success",
  entity: "User",
  entityId: "user-1",
  diff: { ok: true },
  ip: null,
  createdAt: "2026-10-08T04:00:00.000Z",
};

describe("canonicalJson", () => {
  it("sorts object keys", () => {
    expect(canonicalJson({ b: 1, a: "x" })).toBe(canonicalJson({ a: "x", b: 1 }));
  });
});

describe("verifyRows", () => {
  it("accepts a matching chain", () => {
    const firstHash = chainHash(AUDIT_GENESIS, payload);
    const second = { ...payload, action: "auth.logout" };
    const secondHash = chainHash(firstHash, second);
    const result = verifyRows([
      { ...payload, id: BigInt(1), prevHash: AUDIT_GENESIS, hash: firstHash },
      { ...second, id: BigInt(2), prevHash: firstHash, hash: secondHash },
    ]);
    expect(result).toEqual({ valid: true, checked: 2, brokenAtId: null });
  });

  it("fails when a stored row is altered", () => {
    const hash = chainHash(AUDIT_GENESIS, payload);
    const result = verifyRows([
      { ...payload, action: "tampered", id: BigInt(9), prevHash: AUDIT_GENESIS, hash },
    ]);
    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe("9");
  });
});
