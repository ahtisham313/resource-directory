import { z } from "zod";
const errorSchema = z.object({
  error: z.string(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
});
export class ManagementRequestError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}
export async function managementRequest(
  path: string,
  method: string,
  input: unknown,
): Promise<unknown> {
  const multipart = input instanceof FormData;
  const response = await fetch(path, {
    method,
    cache: "no-store",
    headers: multipart ? {} : { "Content-Type": "application/json" },
    body: multipart ? input : JSON.stringify(input),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const parsed = errorSchema.safeParse(data);
    throw new ManagementRequestError(
      parsed.success
        ? parsed.data.error
        : "Unable to complete this request. Please try again.",
      parsed.success ? parsed.data.fieldErrors : undefined,
    );
  }
  return data;
}
