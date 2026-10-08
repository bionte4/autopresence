import { z } from "zod";
import { jsonResult } from "@/modules/master/http";
import { listNotificationPage } from "@/modules/notify/inbox";
import { withAuth } from "@/modules/rbac/with-auth";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

const getNotifications = withAuth({ action: "notification.read" })(async ({ request, user }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = querySchema.parse({ page: params.page || undefined, pageSize: params.pageSize || undefined });
  return jsonResult(await listNotificationPage(user, query));
});

export { getNotifications as GET };
