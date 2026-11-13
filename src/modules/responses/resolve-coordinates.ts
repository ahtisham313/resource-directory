import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  coordinatesSchema,
  ReviewError,
  type Coordinates,
} from "./review-types";

type Address = {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  address: string;
};
export async function resolveCoordinates(
  address: Address,
  manual?: Coordinates,
): Promise<Coordinates & { source: "MANUAL" | "EXISTING" | "GEOCODER" }> {
  if (manual) return { ...coordinatesSchema.parse(manual), source: "MANUAL" };
  const existing = await getDb().resource.findFirst({
    where: {
      streetAddress: { equals: address.streetAddress, mode: "insensitive" },
      city: { equals: address.city, mode: "insensitive" },
      state: { equals: address.state, mode: "insensitive" },
      zipCode: address.zipCode,
      latitude: { not: null },
      longitude: { not: null },
    },
    select: { latitude: true, longitude: true },
  });
  const trusted = coordinatesSchema.safeParse(existing);
  if (trusted.success) return { ...trusted.data, source: "EXISTING" };
  try {
    const endpoint = process.env.GEOCODING_ENDPOINT;
    const identification = process.env.GEOCODING_USER_AGENT;
    if (!endpoint || !identification?.trim())
      throw new Error("No configured geocoder");
    const url = new URL(endpoint);
    // Only an explicitly configured private/self-hosted service is supported, not OSM's shared public API.
    if (
      url.hostname === "nominatim.openstreetmap.org" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        ))
    )
      throw new Error("Unsupported geocoding endpoint");
    if (url.pathname === "/") url.pathname = "/search";
    url.searchParams.set("q", address.address);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": identification },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error("Geocoding unavailable");
    const numeric = z.string().regex(/^-?\d+(?:\.\d+)?$/);
    const result = z
      .array(z.object({ lat: numeric, lon: numeric }))
      .safeParse(await response.json());
    if (!result.success || !result.data[0])
      throw new Error("No location found");
    return {
      ...coordinatesSchema.parse({
        latitude: Number(result.data[0].lat),
        longitude: Number(result.data[0].lon),
      }),
      source: "GEOCODER",
    };
  } catch {
    throw new ReviewError(
      422,
      "Automatic coordinates are unavailable for this address. Enter and verify latitude and longitude to approve it.",
      "COORDINATES_REQUIRED",
    );
  }
}
