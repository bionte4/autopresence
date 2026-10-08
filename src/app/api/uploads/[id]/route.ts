import { jsonResult, routeId } from "@/modules/master/http";
import { withAuth } from "@/modules/rbac/with-auth";
import { getUpload } from "@/modules/uploads/service";

const getOne = withAuth({ action: "upload.read" })(async ({ user, params }) => {
  return jsonResult(await getUpload(user, await routeId(params)));
});

export { getOne as GET };
