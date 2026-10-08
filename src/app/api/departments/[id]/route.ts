import { editDepartment, getDepartment, removeDepartment } from "@/modules/departments/service";
import { jsonResult, readJson, requestIp, routeId } from "@/modules/master/http";
import { withAuth } from "@/modules/rbac/with-auth";

const getOne = withAuth({ action: "department.manage" })(async ({ user, params }) => {
  return jsonResult(await getDepartment(user, await routeId(params)));
});

const patchOne = withAuth({ action: "department.manage" })(async ({ request, user, params }) => {
  return jsonResult(await editDepartment(user, await routeId(params), await readJson(request), requestIp(request)));
});

const deleteOne = withAuth({ action: "department.manage" })(async ({ request, user, params }) => {
  return jsonResult(await removeDepartment(user, await routeId(params), requestIp(request)));
});

export { getOne as GET, patchOne as PATCH, deleteOne as DELETE };
