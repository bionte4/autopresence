import { jsonResult, readJson, requestIp } from "@/modules/master/http";
import { parseListQuery } from "@/modules/master/query";
import { withAuth } from "@/modules/rbac/with-auth";
import { createUser, listUserPage } from "@/modules/users/service";

const getUsers = withAuth({ action: "user.manage" })(async ({ request, user }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = parseListQuery(params, ["name", "email"], "name");
  return jsonResult(await listUserPage(user, query));
});

const postUser = withAuth({ action: "user.manage" })(async ({ request, user }) => {
  return jsonResult(await createUser(user, await readJson(request), requestIp(request)));
});

export { getUsers as GET, postUser as POST };
