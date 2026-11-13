import { NextResponse } from "next/server";
import {
  managementErrors,
  readManagementBody,
} from "@/modules/management/management-api";
import { acceptInvitation } from "@/modules/management/invitation-service";
import { submissionRetryAfter } from "@/modules/surveys/submission-limiter";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };
  try {
    return await managementErrors(async () => {
      const retry = submissionRetryAfter(request);
      if (retry)
        return NextResponse.json(
          { error: "Too many attempts. Please wait before trying again." },
          {
            status: 429,
            headers: { ...headers, "Retry-After": String(retry) },
          },
        );
      return NextResponse.json(
        await acceptInvitation(
          (await params).token,
          await readManagementBody(request),
        ),
        { headers },
      );
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to accept the invitation. Please try again." },
      { status: 503, headers },
    );
  }
}
