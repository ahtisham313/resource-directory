import { z } from "zod";
const failureSchema = z.object({
  error: z.string(),
  issues: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional(),
});
export class BuilderRequestError extends Error {
  constructor(
    message: string,
    public readonly issues: Array<{ path: string; message: string }> = [],
    public readonly status = 0,
  ) {
    super(message);
  }
}
export async function builderRequest(
  path: string,
  method: string,
  body: unknown,
): Promise<unknown> {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const parsed = failureSchema.safeParse(data);
    throw new BuilderRequestError(
      parsed.success
        ? parsed.data.error
        : "Unable to save these changes. Please try again.",
      parsed.success ? parsed.data.issues : [],
      response.status,
    );
  }
  return data;
}
export const createdSurveySchema = z.object({ id: z.string() });
