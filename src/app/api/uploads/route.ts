import { uploadRateLimiter } from "@/modules/auth/rate-limit";
import { jsonResult, requestIp } from "@/modules/master/http";
import { parseListQuery } from "@/modules/master/query";
import { withAuth } from "@/modules/rbac/with-auth";
import { granularitySchema } from "@/modules/uploads/schema";
import { ingestUpload, listUploadPage } from "@/modules/uploads/service";

const getUploads = withAuth({ action: "upload.read" })(async ({ request, user }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = parseListQuery(params, ["createdAt", "originalName"], "createdAt");
  return jsonResult(await listUploadPage(user, query));
});

const postUpload = withAuth({ action: "upload.create" })(async ({ request, user }) => {
  if (!uploadRateLimiter.remaining(user.id)) {
    return Response.json({ error: "Terlalu banyak percobaan upload." }, { status: 429 });
  }
  uploadRateLimiter.hit(user.id);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Berkas wajib diisi." }, { status: 400 });
  }
  const granularity = granularitySchema.parse(String(form.get("granularity") ?? ""));
  const result = await ingestUpload(
    user,
    {
      filename: file.name,
      mime: file.type || "application/octet-stream",
      bytes: new Uint8Array(await file.arrayBuffer()),
      granularity,
      confirm: form.get("confirm") === "true",
    },
    requestIp(request),
  );
  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code, uploadId: result.uploadId, period: result.period },
      { status: result.status },
    );
  }
  return Response.json(result.data);
});

export { getUploads as GET, postUpload as POST };
