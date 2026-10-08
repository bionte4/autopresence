import { jsonResult, readJson, requestIp, routeId } from "@/modules/master/http";
import { withAuth } from "@/modules/rbac/with-auth";
import { editUploadSchedule, removeUploadSchedule } from "@/modules/upload-schedules/service";

const patchSchedule = withAuth({ action: "uploadSchedule.manage" })(async ({ request, user, params }) => {
  return jsonResult(await editUploadSchedule(user, await routeId(params), await readJson(request), requestIp(request)));
});

const deleteSchedule = withAuth({ action: "uploadSchedule.manage" })(async ({ request, user, params }) => {
  return jsonResult(await removeUploadSchedule(user, await routeId(params), requestIp(request)));
});

export { patchSchedule as PATCH, deleteSchedule as DELETE };
