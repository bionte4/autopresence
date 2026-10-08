import { reviewCorrectionSchema } from "@/modules/corrections/schema";
import { findCorrection } from "@/modules/corrections/repo";
import { reviewCorrection } from "@/modules/corrections/service";
import { jsonResult, readJson, requestIp, routeId } from "@/modules/master/http";
import { withAuth } from "@/modules/rbac/with-auth";

function correctionId(request: Request): string {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  return parts.at(-2) ?? "";
}

const reject = withAuth({
  action: "correction.review",
  resource: async ({ request }) => {
    const row = await findCorrection(correctionId(request));
    return {
      departmentId: row?.record.employee.departmentId ?? null,
      reviewSeat: row?.stage,
      ownerUserId: row?.requestedById,
    };
  },
})(async ({ request, user, params }) => {
  const body = reviewCorrectionSchema.parse(await readJson(request));
  return jsonResult(await reviewCorrection(user, await routeId(params), "REJECTED", body.note, requestIp(request)));
});

export { reject as POST };
