import { NextResponse } from "next/server";
import {
  managementApi,
  readManagementBody,
} from "@/modules/management/management-api";
import { inviteAdmin } from "@/modules/management/invitation-service";
export async function POST(request: Request) {
  return managementApi(
    async () =>
      NextResponse.json(await inviteAdmin(await readManagementBody(request))),
    "SUPER_ADMIN",
  );
}
