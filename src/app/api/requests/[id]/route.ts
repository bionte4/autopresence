import { jsonResult, routeId } from "@/modules/master/http";
import { withAuth } from "@/modules/rbac/with-auth";
import { getRequest } from "@/modules/requests/service";

const getOne = withAuth({ action: "attendance.read" })(async ({ user, params }) => {
  return jsonResult(await getRequest(user, await routeId(params)));
});

export { getOne as GET };
