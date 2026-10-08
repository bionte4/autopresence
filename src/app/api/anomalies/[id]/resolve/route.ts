import { jsonResult, readJson, requestIp, routeId } from "@/modules/master/http";
import { findAnomaly } from "@/modules/anomalies/repo";
import { resolveAnomalySchema } from "@/modules/anomalies/schema";
import { resolveAnomaly } from "@/modules/anomalies/service";
import { withAuth } from "@/modules/rbac/with-auth";

const postResolve = withAuth({
  action: "anomaly.resolve",
  resource: async ({ request }) => {
    const parts = new URL(request.url).pathname.split("/");
    const id = parts.at(-2) ?? "";
    const row = await findAnomaly(id);
    return { departmentId: row?.employee?.departmentId, severity: row?.severity };
  },
})(async ({ request, user, params }) => {
  const id = await routeId(params);
  const body = resolveAnomalySchema.parse(await readJson(request));
  return jsonResult(await resolveAnomaly(user, id, body, requestIp(request)));
});

export { postResolve as POST };
