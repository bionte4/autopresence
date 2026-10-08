import { jsonResult } from "@/modules/master/http";
import { getDashboard } from "@/modules/dashboard/service";
import { parseDashboardQuery } from "@/modules/dashboard/schema";
import { withAuth } from "@/modules/rbac/with-auth";

const getAttendance = withAuth({ action: "attendance.read" })(async ({ request, user }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  return jsonResult(await getDashboard(user, parseDashboardQuery(params)));
});

export { getAttendance as GET };
