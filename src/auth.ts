import "server-only";
import { getServerSession, type NextAuthOptions } from "next-auth";
import { connection } from "next/server";
import Credentials from "next-auth/providers/credentials";
import { verifyCredentials } from "@/modules/auth/credentials";
import {
  createAdminToken,
  readSessionAdmin,
  safeAdminRedirect,
} from "@/modules/auth/session-data";

const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/admin/login", error: "/admin/login" },
  providers: [
    Credentials({
      name: "Admin credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          return await verifyCredentials(credentials);
        } catch {
          // Provider errors can reach the client. Never forward database messages.
          console.error("Admin sign-in is temporarily unavailable.");
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Ignore client session updates; only verified credentials establish identity and role.
      return user ? createAdminToken(user) : token;
    },
    async session({ session, token }) {
      return { expires: session.expires, user: readSessionAdmin(token) };
    },
    async redirect({ url, baseUrl }) {
      return safeAdminRedirect(url, baseUrl);
    },
  },
  logger: {
    error(code) {
      console.error("Authentication error:", code);
    },
  },
};

export function getAuthOptions(): NextAuthOptions {
  const secret = process.env.AUTH_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 bytes.");
  }
  return { ...authOptions, secret };
}

export async function auth() {
  // NextAuth generates CSRF randomness; it must run only after a real request arrives.
  await connection();
  return getServerSession(getAuthOptions());
}
