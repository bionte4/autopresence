import { jsonResult, readJson, requestIp } from "@/modules/master/http";
import { parseListQuery } from "@/modules/master/query";
import { withAuth } from "@/modules/rbac/with-auth";
import { createUploadSchedule, listUploadSchedulePage } from "@/modules/upload-schedules/service";

const getSchedules = withAuth({ action: "upload.read" })(async ({ request, user }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  return jsonResult(await listUploadSchedulePage(user, parseListQuery(params, ["granularity", "cutoffTime"], "granularity")));
});

const postSchedule = withAuth({ action: "uploadSchedule.manage" })(async ({ request, user }) => {
  return jsonResult(await createUploadSchedule(user, await readJson(request), requestIp(request)));
});

export { getSchedules as GET, postSchedule as POST };
