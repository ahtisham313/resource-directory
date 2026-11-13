import { NextResponse } from "next/server";
import { builderApi, readBuilderRequest } from "@/modules/surveys/builder-api";
import { publishSurvey } from "@/modules/surveys/builder-service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return builderApi(async () =>
    NextResponse.json(
      await publishSurvey((await params).id, await readBuilderRequest(request)),
    ),
  );
}
