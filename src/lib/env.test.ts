import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const valid = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://absensi_app:absensi_app@localhost:5436/absensi",
  DIRECT_URL: "postgresql://absensi:absensi@localhost:5436/absensi",
  STORAGE_DIR: "./storage",
  AUTH_SECRET: "dev-only-change-me-use-32chars-min",
  AUTH_URL: "http://localhost:3000",
  SEED_PASSWORD: "DevPassword123!",
  SMTP_HOST: "localhost",
  SMTP_PORT: "1025",
  SMTP_FROM: "noreply@example.com",
  APP_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("accepts a complete local configuration", () => {
    const env = parseEnv(valid);
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.NODE_ENV).toBe("test");
  });

  it("rejects a short AUTH_SECRET", () => {
    expect(() => parseEnv({ ...valid, AUTH_SECRET: "short" })).toThrow();
  });
});
