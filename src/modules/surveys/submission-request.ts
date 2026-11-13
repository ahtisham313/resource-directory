import "server-only";
import { SurveyServiceError } from "./survey-error";

export const maxSubmissionBytes = 3 * 1024 * 1024;

export async function parseSubmissionRequest(request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigin = new URL(request.url).origin;
  const configuredOrigin = process.env.NEXTAUTH_URL
    ? new URL(process.env.NEXTAUTH_URL).origin
    : allowedOrigin;
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && origin !== allowedOrigin && origin !== configuredOrigin)
  )
    throw new SurveyServiceError(403, "This request could not be accepted.");
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;"))
    throw new SurveyServiceError(415, "Submit the survey using the form.");
  if (Number(request.headers.get("content-length")) > maxSubmissionBytes)
    throw new SurveyServiceError(413, "The submission is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new SurveyServiceError(400, "The submission is empty.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxSubmissionBytes) {
        await reader.cancel();
        throw new SurveyServiceError(413, "The submission is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let form: FormData;
  try {
    form = await new Response(body, {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    throw new SurveyServiceError(400, "The submission could not be read.");
  }
  const allowed = new Set(["versionId", "answers", "image", "contactFax"]);
  for (const key of form.keys())
    if (!allowed.has(key) || form.getAll(key).length !== 1)
      throw new SurveyServiceError(
        400,
        "The submission contains invalid fields.",
      );
  if (form.has("contactFax") && form.get("contactFax") !== "")
    throw new SurveyServiceError(400, "The submission could not be accepted.");
  const versionId = form.get("versionId"),
    serialized = form.get("answers"),
    image = form.get("image");
  if (typeof versionId !== "string" || typeof serialized !== "string")
    throw new SurveyServiceError(400, "Reload the survey and try again.");
  if (Buffer.byteLength(serialized) > 262144)
    throw new SurveyServiceError(413, "The answers are too large.");
  let answers: unknown;
  try {
    answers = JSON.parse(serialized);
  } catch {
    throw new SurveyServiceError(400, "The answers could not be read.");
  }
  if (image !== null && !(image instanceof File))
    throw new SurveyServiceError(400, "Choose a valid image file.");
  return {
    versionId,
    answers,
    file: image instanceof File ? image : undefined,
  };
}
