import { jsonResult, readJson, requestIp, routeId } from "@/modules/master/http";
import { withAuth } from "@/modules/rbac/with-auth";
import { editSchedule, getSchedule, removeSchedule } from "@/modules/schedules/service";

const getOne = withAuth({ action: "schedule.manage" })(async ({ user, params }) => {
  return jsonResult(await getSchedule(user, await routeId(params)));
});

const patchOne = withAuth({ action: "schedule.manage" })(async ({ request, user, params }) => {
  return jsonResult(await editSchedule(user, await routeId(params), await readJson(request), requestIp(request)));
});

const deleteOne = withAuth({ action: "schedule.manage" })(async ({ request, user, params }) => {
  return jsonResult(await removeSchedule(user, await routeId(params), requestIp(request)));
});

export { getOne as GET, patchOne as PATCH, deleteOne as DELETE };
