import { NextResponse } from "next/server";
import { queryDirectory } from "@/modules/resources/directory-query";
import { directoryApi } from "@/modules/resources/directory-api";
import {
  DirectoryError,
  visitorCoordinatesSchema,
} from "@/modules/resources/directory-types";

export async function GET(request: Request) {
  return directoryApi(async () => {
    const latitude = request.headers.get("x-directory-latitude");
    const longitude = request.headers.get("x-directory-longitude");
    let coordinates = null;
    if (latitude !== null || longitude !== null) {
      const parsed = visitorCoordinatesSchema.safeParse({
        latitude: latitude?.trim() ? Number(latitude) : NaN,
        longitude: longitude?.trim() ? Number(longitude) : NaN,
      });
      if (!parsed.success)
        throw new DirectoryError(400, "Provide valid latitude and longitude.");
      coordinates = parsed.data;
    }
    return NextResponse.json(
      await queryDirectory(
        Object.fromEntries(new URL(request.url).searchParams),
        coordinates,
      ),
    );
  });
}
