import { jsonResult, requestIp, routeId } from "@/modules/master/http";
import { withAuth } from "@/modules/rbac/with-auth";
import { getUpload, removeUpload } from "@/modules/uploads/service";

const getOne = withAuth({ action: "upload.read" })(async ({ user, params }) => {
  return jsonResult(await getUpload(user, await routeId(params)));
});

const deleteOne = withAuth({ action: "upload.delete" })(async ({ request, user, params }) => {
  return jsonResult(await removeUpload(user, await routeId(params), requestIp(request)));
});

export { getOne as GET, deleteOne as DELETE };
