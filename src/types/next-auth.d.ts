import type { SafeAdmin, AdminRole } from "@/modules/auth/auth-types";

declare module "next-auth" {
  interface Session {
    user?: SafeAdmin;
  }
  interface User {
    role: AdminRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AdminRole;
  }
}
