import { routeId } from "@/modules/master/http";
import { withAuth } from "@/modules/rbac/with-auth";
import { openUploadFile } from "@/modules/uploads/service";

const download = withAuth({ action: "upload.download" })(async ({ user, params }) => {
  const result = await openUploadFile(user, await routeId(params));
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  const filename = result.data.filename.replace(/["\r\n]/g, "");
  return new Response(new Uint8Array(result.data.bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
});

export { download as GET };
