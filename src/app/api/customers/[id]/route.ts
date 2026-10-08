import { editCustomer, getCustomer, removeCustomer } from "@/modules/customers/service";
import { jsonResult, readJson, requestIp, routeId } from "@/modules/master/http";
import { withAuth } from "@/modules/rbac/with-auth";

const getOne = withAuth({ action: "department.manage" })(async ({ user, params }) => {
  return jsonResult(await getCustomer(user, await routeId(params)));
});

const patchOne = withAuth({ action: "department.manage" })(async ({ request, user, params }) => {
  return jsonResult(await editCustomer(user, await routeId(params), await readJson(request), requestIp(request)));
});

const deleteOne = withAuth({ action: "department.manage" })(async ({ request, user, params }) => {
  return jsonResult(await removeCustomer(user, await routeId(params), requestIp(request)));
});

export { getOne as GET, patchOne as PATCH, deleteOne as DELETE };
