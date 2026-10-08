import { describe, expect, it } from "vitest";
import { overtimeMinutes, periodLength, requestNote } from "./span";

describe("request span", () => {
  it("counts inclusive calendar days and rejects a reversed range", () => {
    expect(periodLength("2026-10-02", "2026-10-02")).toBe(1);
    expect(periodLength("2026-10-01", "2026-10-03")).toBe(3);
    expect(periodLength("2026-10-03", "2026-10-01")).toBeNull();
  });

  it("counts overtime only after the schedule end", () => {
    expect(overtimeMinutes(1025, 1085)).toBe(60);
    expect(overtimeMinutes(1025, 1025)).toBeNull();
  });

  it("labels leave and sick for the attendance note", () => {
    expect(requestNote("LEAVE")).toBe("Cuti");
    expect(requestNote("SICK")).toBe("Sakit");
  });
});
