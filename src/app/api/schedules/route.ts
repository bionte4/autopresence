import { jsonResult, readJson, requestIp } from "@/modules/master/http";
import { parseListQuery } from "@/modules/master/query";
import { withAuth } from "@/modules/rbac/with-auth";
import { createSchedule, listSchedulePage } from "@/modules/schedules/service";

const getSchedules = withAuth({ action: "schedule.manage" })(async ({ request, user }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = parseListQuery(params, ["name", "startMin"], "name");
  return jsonResult(await listSchedulePage(user, query));
});

const postSchedule = withAuth({ action: "schedule.manage" })(async ({ request, user }) => {
  return jsonResult(await createSchedule(user, await readJson(request), requestIp(request)));
});

export { getSchedules as GET, postSchedule as POST };
