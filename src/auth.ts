import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getEnv } from "@/lib/env";
import { authenticate } from "@/modules/auth/service";
import { loginSchema } from "@/modules/auth/schema";

class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid_credentials";
}

class AccountLockedError extends CredentialsSignin {
  code = "account_locked";
}

class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

const env = getEnv();

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: env.NODE_ENV !== "production",
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Kata sandi", type: "password" },
      },
      authorize: async (credentials, request) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) throw new InvalidCredentialsError();
        const result = await authenticate(parsed.data.email, parsed.data.password, request);
        if (result.ok) return result.user;
        if (result.reason === "locked") throw new AccountLockedError();
        if (result.reason === "rate_limited") throw new RateLimitedError();
        throw new InvalidCredentialsError();
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
