import { jsonResult, readJson, requestIp } from "@/modules/master/http";
import { withAuth } from "@/modules/rbac/with-auth";
import { findRequest } from "@/modules/requests/repo";
import { reviewRequest } from "@/modules/requests/service";
import { reviewRequestSchema } from "@/modules/requests/schema";

function requestId(request: Request): string {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  return parts.at(-2) ?? "";
}

const approve = withAuth({
  action: "request.review",
  resource: async ({ request }) => {
    const row = await findRequest(requestId(request));
    return {
      departmentId: row?.employee.departmentId ?? null,
      reviewSeat: row?.stage,
      ownerUserId: row?.requestedById,
    };
  },
})(async ({ request, user }) => {
  const body = reviewRequestSchema.parse(await readJson(request));
  return jsonResult(await reviewRequest(user, requestId(request), "APPROVED", body.note, requestIp(request)));
});

export { approve as POST };
