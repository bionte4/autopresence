import { withAuth } from "@/modules/rbac/with-auth";
import { parseSoftLaborQuery } from "@/modules/soft-labor/schema";
import { exportSoftLaborWorkbook } from "@/modules/soft-labor/service";

const getExport = withAuth({ action: "attendance.read" })(async ({ request, user }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const result = await exportSoftLaborWorkbook(user, parseSoftLaborQuery(params));
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
