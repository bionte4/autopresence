export function createRateLimiter(limit: number, windowMs: number) {
  const buckets = new Map<string, number[]>();

  function recent(key: string, now: number): number[] {
    return (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
  }

  return {
    remaining(key: string, now = Date.now()): boolean {
      return recent(key, now).length < limit;
    },
    hit(key: string, now = Date.now()): void {
      const stamps = recent(key, now);
      stamps.push(now);
      buckets.set(key, stamps);
    },
  };
}

/** 10 failed attempts per 15 minutes. Account lockout is a separate control. */
export const loginRateLimiter = createRateLimiter(10, 15 * 60 * 1000);

/** Uploads are expensive to parse, so each account gets a separate budget. */
export const uploadRateLimiter = createRateLimiter(20, 15 * 60 * 1000);

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

export function isAccountLocked(lockedUntil: Date | null, now: Date): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
}
