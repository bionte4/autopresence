import { jsonResult, readJson, requestIp } from "@/modules/master/http";
import { parseListQuery } from "@/modules/master/query";
import { createProject, listProjectPage } from "@/modules/projects/service";
import { withAuth } from "@/modules/rbac/with-auth";

const getProjects = withAuth({ action: "department.manage" })(async ({ request, user }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = parseListQuery(params, ["name"], "name");
  return jsonResult(await listProjectPage(user, query));
});

const postProject = withAuth({ action: "department.manage" })(async ({ request, user }) => {
  return jsonResult(await createProject(user, await readJson(request), requestIp(request)));
});

export { getProjects as GET, postProject as POST };
