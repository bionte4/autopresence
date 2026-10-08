import { auditListQuerySchema } from "@/modules/audit/schema";
import { listAuditLog } from "@/modules/audit/service";
import { withAuth } from "@/modules/rbac/with-auth";

const getAuditLog = withAuth({ action: "audit.read" })(async ({ request }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = auditListQuerySchema.parse({
    page: params.page ?? "1",
    pageSize: params.pageSize ?? "20",
    direction: params.direction ?? "desc",
  });
  const data = await listAuditLog(query);
  return Response.json(data);
});

export { getAuditLog as GET };
