import { hash, verify } from "argon2";
import { audit } from "@/modules/audit/service";
import { isAccountLocked, LOCKOUT_MS, loginRateLimiter, MAX_FAILED_LOGINS } from "./rate-limit";
import { clearLoginFailures, findUserByEmail, setLoginFailure } from "./repo";

export type LoginResult =
  | { ok: true; user: { id: string; email: string; name: string } }
  | { ok: false; reason: "invalid" | "locked" | "rate_limited" };

let dummyHash: Promise<string> | undefined;

function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hash("not-a-user-password");
  return dummyHash;
}

function clientIp(request: Request | undefined): string | null {
  const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = request?.headers.get("x-real-ip")?.trim();
  return realIp || null;
}

export async function authenticate(
  email: string,
  password: string,
  request?: Request,
): Promise<LoginResult> {
  const normalized = email.trim().toLowerCase();
  const ip = clientIp(request);
  const now = new Date();

  const emailKey = `email:${normalized}`;
  const ipKey = ip ? `ip:${ip}` : null;
  if (
    !loginRateLimiter.remaining(emailKey, now.getTime()) ||
    (ipKey !== null && !loginRateLimiter.remaining(ipKey, now.getTime()))
  ) {
    await audit({ action: "auth.login.rate_limited", entity: "User", ip });
    return { ok: false, reason: "rate_limited" };
  }

  const user = await findUserByEmail(normalized);
  const passwordHash = user?.passwordHash ?? (await dummyPasswordHash());
  const passwordOk = await verify(passwordHash, password);
  const usable = Boolean(user && user.isActive && user.deletedAt === null && passwordOk);

  if (!user || !usable) {
    loginRateLimiter.hit(emailKey, now.getTime());
    if (ipKey) loginRateLimiter.hit(ipKey, now.getTime());

    if (user && user.isActive && user.deletedAt === null && isAccountLocked(user.lockedUntil, now)) {
      await audit({
        actorId: user.id,
        action: "auth.login.locked",
        entity: "User",
        entityId: user.id,
        ip,
      });
      return { ok: false, reason: "locked" };
    }

    if (user && user.isActive && user.deletedAt === null) {
      const failedLogins = user.failedLogins + 1;
      const lockedUntil =
        failedLogins >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCKOUT_MS) : user.lockedUntil;
      await setLoginFailure(user.id, failedLogins, lockedUntil);
      await audit({
        actorId: user.id,
        action: failedLogins >= MAX_FAILED_LOGINS ? "auth.login.lockout" : "auth.login.failure",
        entity: "User",
        entityId: user.id,
        ip,
      });
      if (failedLogins >= MAX_FAILED_LOGINS) return { ok: false, reason: "locked" };
    } else {
      await audit({ action: "auth.login.failure", entity: "User", ip });
    }
    return { ok: false, reason: "invalid" };
  }

  if (isAccountLocked(user.lockedUntil, now)) {
    loginRateLimiter.hit(emailKey, now.getTime());
    if (ipKey) loginRateLimiter.hit(ipKey, now.getTime());
    await audit({
      actorId: user.id,
      action: "auth.login.locked",
      entity: "User",
      entityId: user.id,
      ip,
    });
    return { ok: false, reason: "locked" };
  }

  await clearLoginFailures(user.id);
  await audit({
    actorId: user.id,
    action: "auth.login.success",
    entity: "User",
    entityId: user.id,
    ip,
  });
  return { ok: true, user: { id: user.id, email: user.email, name: user.name } };
}
