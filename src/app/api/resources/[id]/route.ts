import { NextResponse } from "next/server";
import { directoryApi } from "@/modules/resources/directory-api";
import { getPublicResource } from "@/modules/resources/resource-details";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return directoryApi(async () =>
    NextResponse.json(await getPublicResource((await params).id)),
  );
}
