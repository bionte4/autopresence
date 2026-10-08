import { auth } from "@/auth";
import type { AuthUser } from "@/modules/rbac/policy";
import { findAuthUser } from "./repo";

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return findAuthUser(id);
}
