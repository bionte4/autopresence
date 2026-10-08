import { z } from "zod";
import { jsonResult, readJson } from "@/modules/master/http";
import { markNotificationsRead } from "@/modules/notify/inbox";
import { withAuth } from "@/modules/rbac/with-auth";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).max(100).optional(),
});

const postRead = withAuth({ action: "notification.read" })(async ({ request, user }) => {
  const body = bodySchema.parse((await readJson(request)) ?? {});
  return jsonResult(await markNotificationsRead(user, body.ids));
});

export { postRead as POST };
