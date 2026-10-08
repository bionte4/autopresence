import { verifyAuditChain } from "@/modules/audit/service";
import { withAuth } from "@/modules/rbac/with-auth";

const verifyAudit = withAuth({ action: "audit.verify" })(async () => {
  const result = await verifyAuditChain();
  return Response.json(result);
});

export { verifyAudit as GET };
