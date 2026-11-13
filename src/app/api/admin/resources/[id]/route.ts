import { NextResponse } from "next/server";
import {
  managementApi,
  readManagementBody,
  readResourceEdit,
} from "@/modules/management/management-api";
import {
  changeResource,
  editResource,
} from "@/modules/resources/resource-management";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, { params }: Context) {
  return managementApi(async () => {
    const { input, file } = await readResourceEdit(request);
    return NextResponse.json(
      await editResource((await params).id, input, file),
    );
  });
}
export async function PATCH(request: Request, { params }: Context) {
  return managementApi(async () =>
    NextResponse.json(
      await changeResource(
        (await params).id,
        await readManagementBody(request),
      ),
    ),
  );
}
