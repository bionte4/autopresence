import { jsonResult, requestIp, routeId } from "@/modules/master/http";
import { acknowledgeAnomaly } from "@/modules/anomalies/service";
import { findAnomaly } from "@/modules/anomalies/repo";
import { withAuth } from "@/modules/rbac/with-auth";

const postAck = withAuth({
  action: "anomaly.resolve",
  resource: async ({ request }) => {
    const id = new URL(request.url).pathname.split("/").at(-2) ?? "";
    const row = await findAnomaly(id);
    return { departmentId: row?.employee?.departmentId, severity: row?.severity };
  },
})(async ({ request, user, params }) => {
  const id = await routeId(params);
  return jsonResult(await acknowledgeAnomaly(user, id, requestIp(request)));
});

export { postAck as POST };
