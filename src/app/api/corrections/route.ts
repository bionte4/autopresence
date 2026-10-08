import { createCorrection, listCorrectionPage } from "@/modules/corrections/service";
import { parseCorrectionListQuery } from "@/modules/corrections/schema";
import { findRecordScope } from "@/modules/corrections/repo";
import { jsonResult, readJson, requestIp } from "@/modules/master/http";
import { withAuth } from "@/modules/rbac/with-auth";

const getCorrections = withAuth({ action: "attendance.read" })(async ({ request, user }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  return jsonResult(await listCorrectionPage(user, parseCorrectionListQuery(params)));
});

const postCorrection = withAuth({
  action: "correction.create",
  resource: async ({ request }) => {
    const body = (await request.clone().json().catch(() => null)) as { recordId?: unknown } | null;
    const recordId = typeof body?.recordId === "string" ? body.recordId : "";
    const row = recordId ? await findRecordScope(recordId) : null;
    return { employeeId: row?.employeeId ?? null, departmentId: row?.employee.departmentId ?? null };
  },
})(async ({ request, user }) => {
  return jsonResult(await createCorrection(user, await readJson(request), requestIp(request)));
});

export { getCorrections as GET, postCorrection as POST };
