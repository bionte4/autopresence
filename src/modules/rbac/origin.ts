const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

export function isSameOrigin(request: Request, appUrl: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(appUrl).origin;
}
