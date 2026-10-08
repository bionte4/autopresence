import { createCustomer, listCustomerPage } from "@/modules/customers/service";
import { jsonResult, readJson, requestIp } from "@/modules/master/http";
import { parseListQuery } from "@/modules/master/query";
import { withAuth } from "@/modules/rbac/with-auth";

const getCustomers = withAuth({ action: "department.manage" })(async ({ request, user }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = parseListQuery(params, ["name"], "name");
  return jsonResult(await listCustomerPage(user, query));
});

const postCustomer = withAuth({ action: "department.manage" })(async ({ request, user }) => {
  return jsonResult(await createCustomer(user, await readJson(request), requestIp(request)));
});

export { getCustomers as GET, postCustomer as POST };
