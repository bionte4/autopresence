import { findRequestEmployee } from "@/modules/requests/repo";
import { createRequest, listRequestPage } from "@/modules/requests/service";
import { parseRequestListQuery } from "@/modules/requests/schema";
import { jsonResult, readJson, requestIp } from "@/modules/master/http";
import { withAuth } from "@/modules/rbac/with-auth";

const getRequests = withAuth({ action: "attendance.read" })(async ({ request, user }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  return jsonResult(await listRequestPage(user, parseRequestListQuery(params)));
});

const postRequest = withAuth({
  action: "request.create",
  resource: async ({ request }) => {
    const body = (await request.clone().json().catch(() => null)) as { employeeId?: unknown } | null;
    const employeeId = typeof body?.employeeId === "string" ? body.employeeId : "";
    const row = employeeId ? await findRequestEmployee(employeeId) : null;
    return { employeeId: row?.id ?? null, departmentId: row?.departmentId ?? null };
  },
})(async ({ request, user }) => {
  return jsonResult(await createRequest(user, await readJson(request), requestIp(request)));
});

export { getRequests as GET, postRequest as POST };
