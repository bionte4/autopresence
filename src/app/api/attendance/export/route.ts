import { exportAttendanceCsv } from "@/modules/dashboard/service";
import { parseDashboardQuery } from "@/modules/dashboard/schema";
import { withAuth } from "@/modules/rbac/with-auth";

const getExport = withAuth({ action: "attendance.read" })(async ({ request, user }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const result = await exportAttendanceCsv(user, parseDashboardQuery(params));
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return new Response(result.data.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.data.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
});

export { getExport as GET };
