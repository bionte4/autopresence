import { describe, expect, it } from "vitest";
import { DEFAULT_WORK_SCHEDULE, RECOMPUTE_TOLERANCE_MIN } from "./constants";

describe("DEFAULT_WORK_SCHEDULE", () => {
  it("encodes 08:00–17:05 as minutes since midnight", () => {
    expect(DEFAULT_WORK_SCHEDULE.startMin).toBe(480);
    expect(DEFAULT_WORK_SCHEDULE.endMin).toBe(1025);
    expect(DEFAULT_WORK_SCHEDULE.lateToleranceMin).toBe(0);
  });

  it("keeps recompute tolerance at one minute", () => {
    expect(RECOMPUTE_TOLERANCE_MIN).toBe(1);
  });
});
