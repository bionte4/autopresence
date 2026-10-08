import { hash } from "argon2";
import { PrismaClient, Role } from "@prisma/client";
import { afterAll, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { verifyAuditChain } from "@/modules/audit/service";
import { authenticate } from "@/modules/auth/service";

const admin = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
const email = `lock-${Date.now()}@test.local`;
const password = "CorrectPassword123!";
let userId = "";

afterAll(async () => {
  if (userId) await prisma.user.delete({ where: { id: userId } });
  await admin.$disconnect();
});

it("locks an account after five failures and detects a tampered audit row", async () => {
  const passwordHash = await hash(password);
  const user = await prisma.user.create({
    data: { email, name: "Lock Test", passwordHash, role: Role.EMPLOYEE },
  });
  userId = user.id;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await expect(authenticate(email, "wrong-password")).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  }

  await expect(authenticate(email, "wrong-password")).resolves.toEqual({ ok: false, reason: "locked" });
  await expect(authenticate(email, password)).resolves.toEqual({ ok: false, reason: "locked" });

  await prisma.user.update({
    where: { id: userId },
    data: { lockedUntil: new Date(Date.now() - 60_000) },
  });
  await expect(authenticate(email, password)).resolves.toMatchObject({ ok: true });

  await expect(verifyAuditChain()).resolves.toMatchObject({ valid: true });

  const row = await prisma.auditLog.findFirst({ where: { entityId: userId }, orderBy: { id: "desc" } });
  expect(row).not.toBeNull();
  const original = row?.action ?? "";

  await expect(
    prisma.$executeRaw`UPDATE "AuditLog" SET "action" = 'tampered' WHERE "id" = ${row?.id}`,
  ).rejects.toThrow();

  try {
    await admin.$executeRaw`UPDATE "AuditLog" SET "action" = 'tampered' WHERE "id" = ${row?.id}`;
    const broken = await verifyAuditChain();
    expect(broken.valid).toBe(false);
    expect(broken.brokenAtId).toBe(row?.id.toString());
  } finally {
    await admin.$executeRaw`UPDATE "AuditLog" SET "action" = ${original} WHERE "id" = ${row?.id}`;
  }

  await expect(verifyAuditChain()).resolves.toMatchObject({ valid: true });
});
