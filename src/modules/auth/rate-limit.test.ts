import { describe, expect, it } from "vitest";
import { createRateLimiter, isAccountLocked } from "./rate-limit";

describe("createRateLimiter", () => {
  it("blocks the attempt after the limit inside the window", () => {
    const limiter = createRateLimiter(2, 1_000);
    expect(limiter.remaining("a", 0)).toBe(true);
    limiter.hit("a", 0);
    limiter.hit("a", 10);
    expect(limiter.remaining("a", 20)).toBe(false);
    expect(limiter.remaining("a", 2_000)).toBe(true);
  });
});

describe("isAccountLocked", () => {
  it("is locked only while lockedUntil is in the future", () => {
    const now = new Date("2026-10-08T04:00:00.000Z");
    expect(isAccountLocked(new Date("2026-10-08T04:10:00.000Z"), now)).toBe(true);
    expect(isAccountLocked(new Date("2026-10-08T03:00:00.000Z"), now)).toBe(false);
    expect(isAccountLocked(null, now)).toBe(false);
  });
});
