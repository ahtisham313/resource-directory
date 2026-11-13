import { NextResponse } from "next/server";
import { builderApi, readBuilderRequest } from "@/modules/surveys/builder-api";
import {
  createSurvey,
  listManagedSurveys,
} from "@/modules/surveys/builder-service";
export async function GET() {
  return builderApi(async () => NextResponse.json(await listManagedSurveys()));
}
export async function POST(request: Request) {
  return builderApi(async () =>
    NextResponse.json(await createSurvey(await readBuilderRequest(request)), {
      status: 201,
    }),
  );
}
