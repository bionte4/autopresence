import { z } from "zod";
import type { ServiceResult } from "./result";

export async function routeId(
  params: Promise<Record<string, string | string[]>> | undefined,
): Promise<string> {
  const resolved = params ? await params : {};
  const id = Array.isArray(resolved.id) ? resolved.id[0] : resolved.id;
  return z.string().min(1).parse(id);
}

export function requestIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return request.headers.get("x-real-ip")?.trim() || null;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function jsonResult<T>(result: ServiceResult<T>): Response {
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(result.data);
}
