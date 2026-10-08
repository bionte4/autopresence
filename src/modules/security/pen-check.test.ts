import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === "route.ts" ? [full] : [];
  });
}

describe("security pen-check", () => {
  it("sends CSP, frame denial, and HSTS from the Next config", () => {
    const config = readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
    expect(config).toContain("Content-Security-Policy");
    expect(config).toContain('X-Frame-Options", value: "DENY"');
    expect(config).toContain("Strict-Transport-Security");
  });

  it("rate-limits login and upload, and takes the seed password from the environment", () => {
    const auth = readFileSync(path.join(process.cwd(), "src/modules/auth/service.ts"), "utf8");
    const upload = readFileSync(path.join(process.cwd(), "src/app/api/uploads/route.ts"), "utf8");
    const seed = readFileSync(path.join(process.cwd(), "prisma/seed.ts"), "utf8");
    const sheet = readFileSync(path.join(process.cwd(), "src/modules/dashboard/sheet.ts"), "utf8");
    expect(auth).toContain("loginRateLimiter");
    expect(upload).toContain("uploadRateLimiter");
    expect(seed).toContain("process.env.SEED_PASSWORD");
    expect(seed).not.toContain("DevPassword123!");
    expect(sheet).toContain("[=+\\-@");
  });

  it("has no route that edits the audit log, a revision, or an original upload", () => {
    const root = path.join(process.cwd(), "src/app/api");
    const offenders = routeFiles(root).filter((file) => {
      const source = readFileSync(file, "utf8");
      return /auditLog\.(update|delete)|attendanceRevision\.(update|delete)|storageKey/.test(source) && source.includes("DELETE");
    });
    expect(offenders).toEqual([]);
    const joined = routeFiles(root).map((file) => readFileSync(file, "utf8")).join("\n");
    expect(joined).not.toContain("auditLog.update");
    expect(joined).not.toContain("auditLog.delete");
    expect(joined).not.toContain("attendanceRevision.update");
    expect(joined).not.toContain("attendanceRevision.delete");
  });
});
