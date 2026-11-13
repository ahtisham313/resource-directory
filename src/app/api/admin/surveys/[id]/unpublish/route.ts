import { NextResponse } from "next/server";
import { builderApi, readBuilderRequest } from "@/modules/surveys/builder-api";
import { unpublishSurvey } from "@/modules/surveys/builder-service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return builderApi(async () =>
    NextResponse.json(
      await unpublishSurvey(
        (await params).id,
        await readBuilderRequest(request),
      ),
    ),
  );
}
