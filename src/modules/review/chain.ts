export const REVIEW_CHAIN = ["TEAM_LEADER", "OPERATION_MANAGER", "PROJECT_MANAGER"] as const;

export type ReviewSeatName = (typeof REVIEW_CHAIN)[number];

export const SEAT_LABEL: Record<ReviewSeatName, string> = {
  TEAM_LEADER: "Team Leader",
  OPERATION_MANAGER: "Operation Manager",
  PROJECT_MANAGER: "Project Manager",
};

export type SeatHolder = { seat: ReviewSeatName; userId: string };

export type ChainDecision = {
  seat: ReviewSeatName;
  outcome: "APPROVED" | "REJECTED";
  reviewerName: string;
  note: string;
};

export type ChainStep = {
  seat: ReviewSeatName;
  label: string;
  state: "done" | "current" | "waiting" | "rejected" | "skipped";
  reviewerName: string | null;
  note: string | null;
};

/** First seat the requester does not already hold. An empty seat stays, so it can be filled. */
export function openingSeat(requesterId: string, seats: readonly SeatHolder[]): ReviewSeatName {
  for (const seat of REVIEW_CHAIN) {
    const holder = seats.find((item) => item.seat === seat);
    if (!holder || holder.userId !== requesterId) return seat;
  }
  return "PROJECT_MANAGER";
}

/** Next seat after an approval. Seats the requester holds are skipped. Null means the chain is finished. */
export function seatAfterApproval(
  current: ReviewSeatName,
  requesterId: string,
  seats: readonly SeatHolder[],
): ReviewSeatName | null {
  const start = REVIEW_CHAIN.indexOf(current) + 1;
  for (let index = start; index < REVIEW_CHAIN.length; index += 1) {
    const seat = REVIEW_CHAIN[index];
    if (!seat) return null;
    const holder = seats.find((item) => item.seat === seat);
    if (!holder || holder.userId !== requesterId) return seat;
  }
  return null;
}

export function pendingLabel(stage: ReviewSeatName): string {
  return `Menunggu ${SEAT_LABEL[stage]}`;
}

export function chainSteps(input: {
  status: "PENDING" | "APPROVED" | "REJECTED";
  stage: ReviewSeatName;
  decisions: readonly ChainDecision[];
}): ChainStep[] {
  if (input.status !== "PENDING" && input.decisions.length === 0) return [];
  const stageIndex = REVIEW_CHAIN.indexOf(input.stage);
  return REVIEW_CHAIN.map((seat, index) => {
    const decision = input.decisions.find((item) => item.seat === seat);
    if (decision?.outcome === "REJECTED") {
      return { seat, label: SEAT_LABEL[seat], state: "rejected", reviewerName: decision.reviewerName, note: decision.note };
    }
    if (decision?.outcome === "APPROVED") {
      return { seat, label: SEAT_LABEL[seat], state: "done", reviewerName: decision.reviewerName, note: decision.note };
    }
    const passed = input.status === "APPROVED" || index < stageIndex;
    if (passed) return { seat, label: SEAT_LABEL[seat], state: "skipped", reviewerName: null, note: null };
    if (input.status === "PENDING" && seat === input.stage) {
      return { seat, label: SEAT_LABEL[seat], state: "current", reviewerName: null, note: null };
    }
    return { seat, label: SEAT_LABEL[seat], state: "waiting", reviewerName: null, note: null };
  });
}
