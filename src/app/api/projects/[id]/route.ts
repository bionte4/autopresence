import { jsonResult, readJson, requestIp, routeId } from "@/modules/master/http";
import { editProject, getProject, removeProject } from "@/modules/projects/service";
import { withAuth } from "@/modules/rbac/with-auth";

const getOne = withAuth({ action: "department.manage" })(async ({ user, params }) => {
  return jsonResult(await getProject(user, await routeId(params)));
});

const patchOne = withAuth({ action: "department.manage" })(async ({ request, user, params }) => {
  return jsonResult(await editProject(user, await routeId(params), await readJson(request), requestIp(request)));
});

const deleteOne = withAuth({ action: "department.manage" })(async ({ request, user, params }) => {
  return jsonResult(await removeProject(user, await routeId(params), requestIp(request)));
});

export { getOne as GET, patchOne as PATCH, deleteOne as DELETE };
