import { NextResponse } from "next/server";
import { managementApi } from "@/modules/management/management-api";
import { getNotifications } from "@/modules/management/notifications";
export async function GET(request: Request) {
  return managementApi(async () =>
    NextResponse.json(
      await getNotifications(
        new URL(request.url).searchParams.get("cursor") ?? undefined,
      ),
    ),
  );
}
