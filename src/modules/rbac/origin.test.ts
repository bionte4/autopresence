import { describe, expect, it } from "vitest";
import { isSafeMethod, isSameOrigin } from "./origin";

describe("isSameOrigin", () => {
  it("accepts the configured origin and rejects a missing or foreign origin", () => {
    const appUrl = "http://localhost:3000";
    expect(isSameOrigin(new Request("http://localhost:3000/api/audit", { headers: { origin: appUrl } }), appUrl)).toBe(
      true,
    );
    expect(isSameOrigin(new Request("http://localhost:3000/api/audit"), appUrl)).toBe(false);
    expect(
      isSameOrigin(
        new Request("http://localhost:3000/api/audit", { headers: { origin: "https://evil.example" } }),
        appUrl,
      ),
    ).toBe(false);
  });
});

describe("isSafeMethod", () => {
  it("treats reads as safe", () => {
    expect(isSafeMethod("GET")).toBe(true);
    expect(isSafeMethod("POST")).toBe(false);
  });
});
