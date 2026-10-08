import type { ReviewOutcome, ReviewSeat } from "@prisma/client";
import { prisma, type Db } from "@/lib/prisma";

export async function listSeats(departmentId: string, db: Db = prisma) {
  return db.departmentReviewer.findMany({
    where: { departmentId },
    select: { seat: true, userId: true },
  });
}

export async function insertDecision(
  db: Db,
  data: {
    seat: ReviewSeat;
    outcome: ReviewOutcome;
    note: string;
    reviewerId: string;
    correctionId?: string;
    requestId?: string;
  },
) {
  return db.reviewDecision.create({ data, select: { id: true } });
}
