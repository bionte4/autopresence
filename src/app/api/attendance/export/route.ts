import { exportAttendanceWorkbook } from "@/modules/dashboard/service";
import { parseDashboardQuery } from "@/modules/dashboard/schema";
import { withAuth } from "@/modules/rbac/with-auth";

const getExport = withAuth({ action: "attendance.read" })(async ({ request, user }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const result = await exportAttendanceWorkbook(user, parseDashboardQuery(params));
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return new Response(new Uint8Array(result.data.body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${result.data.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
});

export { getExport as GET };
