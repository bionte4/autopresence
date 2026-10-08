import { reviewCorrectionSchema } from "@/modules/corrections/schema";
import { reviewCorrection } from "@/modules/corrections/service";
import { jsonResult, readJson, requestIp, routeId } from "@/modules/master/http";
import { withAuth } from "@/modules/rbac/with-auth";

const reject = withAuth({ action: "correction.review" })(async ({ request, user, params }) => {
  const body = reviewCorrectionSchema.parse(await readJson(request));
  return jsonResult(await reviewCorrection(user, await routeId(params), "REJECTED", body.note, requestIp(request)));
});

export { reject as POST };
