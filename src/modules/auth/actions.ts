"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { auth, signIn, signOut } from "@/auth";
import { audit } from "@/modules/audit/service";
import { findAuthUser } from "./repo";

export type LoginState = { error: string } | null;

function loginMessage(error: AuthError): string {
  if (error instanceof CredentialsSignin) {
    if (error.code === "account_locked") return "Akun terkunci sementara. Coba lagi nanti.";
    if (error.code === "rate_limited") return "Terlalu banyak percobaan. Coba lagi nanti.";
  }
  return "Email atau kata sandi salah.";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/beranda",
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: loginMessage(error) };
    throw error;
  }
  return null;
}

export async function logoutAction(): Promise<void> {
  const session = await auth();
  const user = session?.user?.id ? await findAuthUser(session.user.id) : null;
  if (user) {
    await audit({
      actorId: user.id,
      action: "auth.logout",
      entity: "User",
      entityId: user.id,
    });
  }
  await signOut({ redirectTo: "/login" });
}
