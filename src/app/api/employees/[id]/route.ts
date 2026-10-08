import { editEmployee, getEmployee, removeEmployee } from "@/modules/employees/service";
import { jsonResult, readJson, requestIp, routeId } from "@/modules/master/http";
import { withAuth } from "@/modules/rbac/with-auth";

const getOne = withAuth({ action: "employee.manage" })(async ({ user, params }) => {
  return jsonResult(await getEmployee(user, await routeId(params)));
});

const patchOne = withAuth({ action: "employee.manage" })(async ({ request, user, params }) => {
  return jsonResult(await editEmployee(user, await routeId(params), await readJson(request), requestIp(request)));
});

const deleteOne = withAuth({ action: "employee.manage" })(async ({ request, user, params }) => {
  return jsonResult(await removeEmployee(user, await routeId(params), requestIp(request)));
});

export { getOne as GET, patchOne as PATCH, deleteOne as DELETE };
