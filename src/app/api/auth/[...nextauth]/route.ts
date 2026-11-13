import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthOptions } from "@/auth";
import { loginRetryAfter } from "@/modules/auth/login-limiter";

async function handler(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> },
) {
  const { nextauth } = await context.params;
  if (
    request.method === "POST" &&
    nextauth[0] === "callback" &&
    nextauth[1] === "credentials"
  ) {
    const retry = loginRetryAfter(request);
    if (retry)
      return NextResponse.json(
        {
          url: new URL(
            "/admin/login?error=CredentialsSignin",
            process.env.NEXTAUTH_URL ?? request.url,
          ).href,
        },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(retry),
          },
        },
      );
  }
  return NextAuth(getAuthOptions())(request, context);
}
export { handler as GET, handler as POST };
