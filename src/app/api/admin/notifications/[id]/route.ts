import { NextResponse } from "next/server";
import {
  managementApi,
  readManagementBody,
} from "@/modules/management/management-api";
import { markNotificationRead } from "@/modules/management/notifications";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return managementApi(async () => {
    await readManagementBody(request);
    return NextResponse.json(await markNotificationRead((await params).id));
  });
}
