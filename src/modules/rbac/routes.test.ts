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

describe("API routes", () => {
  it("requires withAuth except the Auth.js handler", () => {
    const root = path.join(process.cwd(), "src/app/api");
    const files = routeFiles(root);
    const offenders = files.filter((file) => {
      const rel = path.relative(root, file);
      if (rel.startsWith(`auth${path.sep}`)) return false;
      return !readFileSync(file, "utf8").includes("withAuth(");
    });
    expect(offenders).toEqual([]);
    expect(files.some((file) => file.includes(`${path.sep}auth${path.sep}`))).toBe(true);
  });
});
