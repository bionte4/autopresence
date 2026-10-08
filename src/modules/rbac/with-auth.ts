import { ZodError } from "zod";
import { getEnv } from "@/lib/env";
import { getCurrentUser } from "@/modules/auth/current-user";
import { isSafeMethod, isSameOrigin } from "./origin";
import { can, type Action, type AuthUser, type Resource } from "./policy";

type HandlerArgs = {
  request: Request;
  user: AuthUser;
  params: Promise<Record<string, string | string[]>> | undefined;
};

type Handler = (args: HandlerArgs) => Promise<Response>;

type RouteContext = {
  params: Promise<Record<string, string | string[]>>;
};

export function withAuth(options: {
  action: Action;
  resource?: (args: { request: Request; user: AuthUser }) => Promise<Resource | undefined> | Resource | undefined;
}) {
  return function wrap(handler: Handler) {
    return async function route(request: Request, context?: RouteContext): Promise<Response> {
      if (!isSafeMethod(request.method) && !isSameOrigin(request, getEnv().APP_URL)) {
        return Response.json({ error: "Permintaan ditolak." }, { status: 403 });
      }

      const user = await getCurrentUser();
      if (!user) {
        return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
      }

      const resource = options.resource ? await options.resource({ request, user }) : undefined;
      if (!can(user, options.action, resource)) {
        return Response.json({ error: "Tidak diizinkan." }, { status: 403 });
      }

      try {
        return await handler({ request, user, params: context?.params });
      } catch (error) {
        if (error instanceof ZodError) {
          return Response.json({ error: "Permintaan tidak valid." }, { status: 400 });
        }
        throw error;
      }
    };
  };
}
