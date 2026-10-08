import { parseDashboardQuery } from "@/modules/dashboard/schema";
import { jsonResult } from "@/modules/master/http";
import { withAuth } from "@/modules/rbac/with-auth";
import { exportTimesheet } from "@/modules/timesheet/service";

const getExport = withAuth({ action: "attendance.read" })(async ({ request, user }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const period = parseDashboardQuery(params);
  const employeeId = params.employeeId ?? "";
  const result = await exportTimesheet(user, employeeId, { from: period.from, to: period.to });
  if (!result.ok) return jsonResult(result);
  return new Response(new Uint8Array(result.data.body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${result.data.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
});

export { getExport as GET };
