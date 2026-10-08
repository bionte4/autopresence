import { jsonResult } from "@/modules/master/http";
import { listAnomalyPage } from "@/modules/anomalies/service";
import { parseAnomalyListQuery } from "@/modules/anomalies/schema";
import { withAuth } from "@/modules/rbac/with-auth";

const getAnomalies = withAuth({ action: "anomaly.read" })(async ({ request, user }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  return jsonResult(await listAnomalyPage(user, parseAnomalyListQuery(params)));
});

export { getAnomalies as GET };
