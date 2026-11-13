import { NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/admin-api";

export async function GET() {
  return withAdmin((admin) => NextResponse.json({ admin }));
}
