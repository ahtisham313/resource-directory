import { NextResponse } from "next/server";
import { surveyIdSchema } from "@/modules/surveys/survey-definition";
import { parseSubmissionRequest } from "@/modules/surveys/submission-request";
import { submissionRetryAfter } from "@/modules/surveys/submission-limiter";
import { submitSurvey } from "@/modules/surveys/submit-survey";
import { SurveyServiceError } from "@/modules/surveys/survey-error";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const { id } = await params;
    if (!surveyIdSchema.safeParse(id).success)
      throw new SurveyServiceError(404, "This survey is not available.");
    const retryAfter = submissionRetryAfter(request);
    if (retryAfter)
      return NextResponse.json(
        { error: "Please wait before trying again." },
        {
          status: 429,
          headers: { ...headers, "Retry-After": String(retryAfter) },
        },
      );
    const input = await parseSubmissionRequest(request);
    const result = await submitSurvey(
      id,
      input.versionId,
      input.answers,
      input.file,
    );
    return NextResponse.json(result, { status: 201, headers });
  } catch (error) {
    if (error instanceof SurveyServiceError)
      return NextResponse.json(
        {
          error: error.message,
          ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
        },
        { status: error.status, headers },
      );
    return NextResponse.json(
      { error: "Unable to submit the survey. Please try again." },
      { status: 503, headers },
    );
  }
}
