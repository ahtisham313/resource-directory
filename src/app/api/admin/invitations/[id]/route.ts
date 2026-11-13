import { NextResponse } from "next/server";
import {
  managementApi,
  readManagementBody,
} from "@/modules/management/management-api";
import { cancelInvitation } from "@/modules/management/invitation-service";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return managementApi(async () => {
    await readManagementBody(request);
    return NextResponse.json(await cancelInvitation((await params).id));
  }, "SUPER_ADMIN");
}
