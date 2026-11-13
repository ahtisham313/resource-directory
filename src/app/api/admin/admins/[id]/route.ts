import { NextResponse } from "next/server";
import { z } from "zod";
import { ManagementError } from "@/modules/management/management-types";
import {
  managementApi,
  readManagementBody,
} from "@/modules/management/management-api";
import {
  updateAdmin,
  deleteAdmin,
} from "@/modules/management/admin-management";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  return managementApi(
    async () =>
      NextResponse.json(
        await updateAdmin((await params).id, await readManagementBody(request)),
      ),
    "SUPER_ADMIN",
  );
}
export async function DELETE(request: Request, { params }: Context) {
  return managementApi(async () => {
    const body = z
      .object({ revision: z.string() })
      .strict()
      .safeParse(await readManagementBody(request));
    if (!body.success)
      throw new ManagementError(400, "Reload the admin list before deleting.");
    return NextResponse.json(
      await deleteAdmin((await params).id, body.data.revision),
    );
  }, "SUPER_ADMIN");
}
