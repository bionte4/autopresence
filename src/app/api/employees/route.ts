import { createEmployee, listEmployeePage } from "@/modules/employees/service";
import { jsonResult, readJson, requestIp } from "@/modules/master/http";
import { parseListQuery } from "@/modules/master/query";
import { withAuth } from "@/modules/rbac/with-auth";

const getEmployees = withAuth({ action: "employee.manage" })(async ({ request, user }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = parseListQuery(params, ["name", "pin"], "name");
  return jsonResult(await listEmployeePage(user, query));
});

const postEmployee = withAuth({ action: "employee.manage" })(async ({ request, user }) => {
  return jsonResult(await createEmployee(user, await readJson(request), requestIp(request)));
});

export { getEmployees as GET, postEmployee as POST };
