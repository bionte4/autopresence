import { describe, expect, it } from "vitest";
import { chainSteps, openingSeat, seatAfterApproval } from "./chain";

const seats = [
  { seat: "TEAM_LEADER" as const, userId: "lead" },
  { seat: "OPERATION_MANAGER" as const, userId: "ops" },
  { seat: "PROJECT_MANAGER" as const, userId: "pm" },
];

describe("review chain", () => {
  it("starts at team leader for a pegawai", () => {
    expect(openingSeat("staff", seats)).toBe("TEAM_LEADER");
  });

  it("skips a seat the requester already holds", () => {
    expect(openingSeat("lead", seats)).toBe("OPERATION_MANAGER");
    expect(seatAfterApproval("TEAM_LEADER", "ops", seats)).toBe("PROJECT_MANAGER");
  });

  it("stops on an empty seat instead of jumping over it", () => {
    expect(seatAfterApproval("TEAM_LEADER", "staff", [seats[0]!])).toBe("OPERATION_MANAGER");
  });

  it("finishes after project manager approves", () => {
    expect(seatAfterApproval("PROJECT_MANAGER", "staff", seats)).toBeNull();
  });

  it("shows the current seat and keeps earlier approvals", () => {
    expect(
      chainSteps({
        status: "PENDING",
        stage: "OPERATION_MANAGER",
        decisions: [{ seat: "TEAM_LEADER", outcome: "APPROVED", reviewerName: "Andi", note: "Oke" }],
      }),
    ).toMatchObject([
      { seat: "TEAM_LEADER", state: "done" },
      { seat: "OPERATION_MANAGER", state: "current" },
      { seat: "PROJECT_MANAGER", state: "waiting" },
    ]);
  });

  it("hides the chain for rows decided before seats existed", () => {
    expect(chainSteps({ status: "APPROVED", stage: "TEAM_LEADER", decisions: [] })).toEqual([]);
  });
});
