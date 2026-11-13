import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseSubmissionRequest,
  maxSubmissionBytes,
} from "../src/modules/surveys/submission-request";
import { createSubmissionLimiter } from "../src/modules/surveys/submission-limiter";
import { POST } from "../src/app/api/surveys/[id]/responses/route";
import { SurveyServiceError } from "../src/modules/surveys/survey-error";

const { submit, retry } = vi.hoisted(() => ({
  submit: vi.fn(),
  retry: vi.fn(),
}));
vi.mock("@/modules/surveys/submit-survey", () => ({ submitSurvey: submit }));
vi.mock("@/modules/surveys/submission-limiter", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../src/modules/surveys/submission-limiter")
  >()),
  submissionRetryAfter: retry,
}));
function request(
  extra?: Record<string, string>,
  headers?: Record<string, string>,
) {
  const body = new FormData();
  body.set("versionId", "version-1");
  body.set("answers", "{}");
  body.set("contactFax", "");
  for (const [key, value] of Object.entries(extra ?? {})) body.set(key, value);
  return new Request("http://localhost/api/surveys/example/responses", {
    method: "POST",
    body,
    headers,
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  retry.mockReturnValue(0);
  submit.mockResolvedValue({ message: "Thank you", status: "PENDING" });
});
describe("public request protection", () => {
  it("reads a controlled multipart submission", async () => {
    expect(await parseSubmissionRequest(request())).toEqual({
      versionId: "version-1",
      answers: {},
      file: undefined,
    });
  });
  it("rejects honeypots, injected server fields, duplicate fields and malformed answers", async () => {
    const cases: Record<string, string>[] = [
      { contactFax: "bot" },
      { status: "APPROVED" },
      { answers: "not JSON" },
    ];
    for (const values of cases)
      await expect(
        parseSubmissionRequest(request(values)),
      ).rejects.toMatchObject({ status: 400 });
    const body = new FormData();
    body.append("versionId", "one");
    body.append("versionId", "two");
    body.set("answers", "{}");
    await expect(
      parseSubmissionRequest(
        new Request("http://localhost/api", { method: "POST", body }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("rejects cross-site requests and unsupported content types", async () => {
    await expect(
      parseSubmissionRequest(
        request({}, { Origin: "https://untrusted.example" }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      parseSubmissionRequest(
        new Request("http://localhost/api", {
          method: "POST",
          body: "{}",
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ).rejects.toMatchObject({ status: 415 });
  });
  it("bounds the actual request stream even without a trustworthy content length", async () => {
    await expect(
      parseSubmissionRequest(
        new Request("http://localhost/api", {
          method: "POST",
          body: new Uint8Array(maxSubmissionBytes + 1),
          headers: { "Content-Type": "multipart/form-data; boundary=example" },
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      parseSubmissionRequest(
        request({ answers: '"' + "a".repeat(262144) + '"' }),
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("bounds the limiter and expires its short-lived counters", () => {
    const limit = createSubmissionLimiter(2, 1000, 2);
    expect(limit("a", 0)).toBe(0);
    expect(limit("a", 1)).toBe(0);
    expect(limit("a", 2)).toBe(1);
    expect(limit("a", 1001)).toBe(0);
    limit("b", 1002);
    limit("c", 1003);
    expect(limit("a", 1004)).toBe(0);
  });
});
describe("public response endpoint", () => {
  const context = { params: Promise.resolve({ id: "example" }) };
  it("returns 201 without requiring an admin session", async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      message: "Thank you",
      status: "PENDING",
    });
  });
  it("returns 429 and Retry-After without parsing or saving a rapid submission", async () => {
    retry.mockReturnValue(25);
    const response = await POST(request(), context);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("25");
    expect(submit).not.toHaveBeenCalled();
  });
  it("returns controlled field errors and hides unexpected internal errors", async () => {
    submit.mockRejectedValueOnce(
      new SurveyServiceError(422, "Check answers", { example: "Required" }),
    );
    const invalid = await POST(request(), context);
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toEqual({
      error: "Check answers",
      fieldErrors: { example: "Required" },
    });
    submit.mockRejectedValueOnce(
      new Error("database password and storage key"),
    );
    const failed = await POST(request(), context);
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("password");
  });
});
