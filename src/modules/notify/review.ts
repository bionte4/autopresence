import type { ReviewSeat } from "@prisma/client";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { SEAT_LABEL, type ReviewSeatName } from "@/modules/review/chain";
import { resolveMailer } from "./mailer";
import { insertNotification, markNotification } from "./repo";

type Subject = "correction" | "leave" | "sick" | "overtime";

const LABEL: Record<Subject, string> = {
  correction: "Koreksi",
  leave: "Cuti",
  sick: "Sakit",
  overtime: "Lembur",
};

/** Tell the person whose turn it is. A missing holder, or the requester, is skipped. */
export async function notifySeatHolder(input: {
  userId: string | null;
  requesterId: string;
  seat: ReviewSeatName;
  kind: Subject;
  subjectId: string;
  employeeName: string;
  detail: string;
}): Promise<void> {
  if (!input.userId || input.userId === input.requesterId) return;
  const label = LABEL[input.kind];
  await deliver({
    userId: input.userId,
    seat: input.seat,
    kind: input.kind,
    subjectId: input.subjectId,
    title: `${label} menunggu ${SEAT_LABEL[input.seat]}`,
    body: `${input.employeeName}. ${input.detail}`,
  });
}

/** Tell the requester the chain finished, unless they made the last decision themselves. */
export async function notifyRequester(input: {
  userId: string;
  actorId: string;
  seat: ReviewSeatName;
  kind: Subject;
  subjectId: string;
  employeeName: string;
  outcome: "APPROVED" | "REJECTED";
}): Promise<void> {
  if (input.userId === input.actorId) return;
  const label = LABEL[input.kind];
  const title = input.outcome === "APPROVED" ? `${label} disetujui` : `${label} ditolak`;
  await deliver({
    userId: input.userId,
    seat: input.seat,
    kind: input.kind,
    subjectId: input.subjectId,
    title,
    body: `${input.employeeName}. ${title}.`,
  });
}

async function deliver(input: {
  userId: string;
  seat: ReviewSeat;
  kind: Subject;
  subjectId: string;
  title: string;
  body: string;
}): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true, isActive: true, deletedAt: true } });
    if (!user || !user.isActive || user.deletedAt) return;
    const request = input.kind !== "correction";
    const link = request ? `/requests/${input.subjectId}` : `/corrections/${input.subjectId}`;
    const subject = request ? { correctionId: null, requestId: input.subjectId } : { correctionId: input.subjectId, requestId: null };
    await insertNotification({ userId: input.userId, ...subject, seat: input.seat, title: input.title, body: input.body, channel: "IN_APP", status: "SENT" });
    const email = await insertNotification({ userId: input.userId, ...subject, seat: input.seat, title: input.title, body: input.body, channel: "EMAIL", status: "PENDING" });
    if (email !== "created") return;
    const pending = await prisma.notification.findFirst({
      where: { userId: input.userId, channel: "EMAIL", status: "PENDING", seat: input.seat, ...subject },
      select: { id: true, attempts: true },
    });
    if (!pending) return;
    try {
      await resolveMailer().send({ to: user.email, subject: input.title, text: `${input.body}\n\n${getEnv().APP_URL}${link}` });
      await markNotification(pending.id, { status: "SENT", attempts: pending.attempts + 1 });
    } catch {
      await markNotification(pending.id, { status: "FAILED", attempts: pending.attempts + 1 });
    }
  } catch {
    // The decision is already stored. A notice failure must not undo it.
  }
}
