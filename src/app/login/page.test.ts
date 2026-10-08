import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("login page", () => {
  it("renders an enabled Indonesian sign-in form", () => {
    const page = readFileSync(path.join(process.cwd(), "src/app/login/page.tsx"), "utf8");
    const form = readFileSync(path.join(process.cwd(), "src/app/login/login-form.tsx"), "utf8");
    expect(page).toContain("Absensi Monitor");
    expect(form).toContain('"Masuk"');
    expect(form).not.toContain("belum aktif");
    expect(form).toContain('type="submit"');
  });
});
