import { NextResponse } from "next/server";
import { builderApi, readBuilderRequest } from "@/modules/surveys/builder-api";
import {
  getSurveyEditor,
  saveSurveyDraft,
  deleteSurvey,
} from "@/modules/surveys/builder-service";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  return builderApi(async () =>
    NextResponse.json(await getSurveyEditor((await params).id)),
  );
}
export async function PUT(request: Request, { params }: Context) {
  return builderApi(async () =>
    NextResponse.json(
      await saveSurveyDraft(
        (await params).id,
        await readBuilderRequest(request),
      ),
    ),
  );
}
export async function DELETE(request: Request, { params }: Context) {
  return builderApi(async () =>
    NextResponse.json(
      await deleteSurvey((await params).id, await readBuilderRequest(request)),
    ),
  );
}
