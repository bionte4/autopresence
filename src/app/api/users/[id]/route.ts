import { jsonResult, readJson, requestIp, routeId } from "@/modules/master/http";
import { withAuth } from "@/modules/rbac/with-auth";
import { editUser, getUser, removeUser } from "@/modules/users/service";

const getOne = withAuth({ action: "user.manage" })(async ({ user, params }) => {
  return jsonResult(await getUser(user, await routeId(params)));
});

const patchOne = withAuth({ action: "user.manage" })(async ({ request, user, params }) => {
  return jsonResult(await editUser(user, await routeId(params), await readJson(request), requestIp(request)));
});

const deleteOne = withAuth({ action: "user.manage" })(async ({ request, user, params }) => {
  return jsonResult(await removeUser(user, await routeId(params), requestIp(request)));
});

export { getOne as GET, patchOne as PATCH, deleteOne as DELETE };
