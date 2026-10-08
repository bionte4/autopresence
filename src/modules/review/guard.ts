import type { ReviewSeat } from "@prisma/client";
import { denied, invalid, type ServiceResult } from "@/modules/master/result";
import { can, type AuthUser } from "@/modules/rbac/policy";
import { SEAT_LABEL, type SeatHolder } from "./chain";
import { listSeats } from "./repo";

export async function guardSeat(
  actor: AuthUser,
  action: "request.review" | "correction.review",
  input: { departmentId: string | null; stage: ReviewSeat; requesterId: string },
): Promise<ServiceResult<SeatHolder[]>> {
  if (!input.departmentId) {
    return invalid("Pegawai belum masuk departemen, jadi rantai peninjau belum bisa berjalan.");
  }
  const departmentId = input.departmentId;
  const seats = await listSeats(departmentId);
  const seated: AuthUser = {
    ...actor,
    reviewSeats: seats
      .filter((seat) => seat.userId === actor.id)
      .map((seat) => ({ departmentId, seat: seat.seat })),
  };
  if (
    !can(seated, action, {
      departmentId,
      reviewSeat: input.stage,
      ownerUserId: input.requesterId,
    })
  ) {
    const holder = seats.find((seat) => seat.seat === input.stage);
    if (!holder) return invalid(`Belum ada ${SEAT_LABEL[input.stage]} pada departemen ini.`);
    if (holder.userId === actor.id) return invalid("Pengaju tidak dapat menyetujui tahapnya sendiri.");
    return denied();
  }
  return { ok: true, data: seats };
}
