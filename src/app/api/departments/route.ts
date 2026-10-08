import { createDepartment, listDepartmentPage } from "@/modules/departments/service";
import { jsonResult, readJson, requestIp } from "@/modules/master/http";
import { parseListQuery } from "@/modules/master/query";
import { withAuth } from "@/modules/rbac/with-auth";

const getDepartments = withAuth({ action: "department.manage" })(async ({ request, user }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = parseListQuery(params, ["name"], "name");
  return jsonResult(await listDepartmentPage(user, query));
});

const postDepartment = withAuth({ action: "department.manage" })(async ({ request, user }) => {
  return jsonResult(await createDepartment(user, await readJson(request), requestIp(request)));
});

export { getDepartments as GET, postDepartment as POST };
