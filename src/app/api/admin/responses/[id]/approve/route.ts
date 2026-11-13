import { NextResponse } from "next/server";
import { reviewApi, readReviewRequest } from "@/modules/responses/review-api";
import { approveResponse } from "@/modules/responses/review-mutations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return reviewApi(async () => {
    const { id } = await params;
    return NextResponse.json(
      await approveResponse(id, await readReviewRequest(request)),
    );
  });
}
