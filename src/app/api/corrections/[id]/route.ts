import { getCorrection } from "@/modules/corrections/service";
import { jsonResult, routeId } from "@/modules/master/http";
import { withAuth } from "@/modules/rbac/with-auth";

const getOne = withAuth({ action: "attendance.read" })(async ({ user, params }) => {
  return jsonResult(await getCorrection(user, await routeId(params)));
});

export { getOne as GET };
