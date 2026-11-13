import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultSurvey,
  defaultVersionId,
} from "../prisma/seed-data/default-survey";
import { sampleResources } from "../prisma/seed-data/sample-resources";
import { submitSurvey } from "../src/modules/surveys/submit-survey";
import { SurveyServiceError } from "../src/modules/surveys/survey-error";
import { surveyImage } from "./fixtures/survey-images";

const { published, transaction, create, put, remove, storage } = vi.hoisted(
  () => ({
    published: vi.fn(),
    transaction: vi.fn(),
    create: vi.fn(),
    put: vi.fn(),
    remove: vi.fn(),
    storage: vi.fn(),
  }),
);
vi.mock("@/modules/surveys/published-survey", () => ({
  getPublishedSurvey: published,
}));
vi.mock("@/lib/db", () => ({ getDb: () => ({ $transaction: transaction }) }));
vi.mock("@/lib/image-storage", () => ({
  getImageStorage: storage,
  createImageKey: () => "pending/unit-test-image.png",
}));
beforeEach(() => {
  vi.resetAllMocks();
  published.mockResolvedValue({
    versionId: defaultVersionId,
    snapshot: defaultSurvey,
  });
  transaction.mockImplementation(async (callback) =>
    callback({ $queryRaw: vi.fn(), surveyResponse: { create } }),
  );
  create.mockResolvedValue({ id: "private-response-id" });
  put.mockResolvedValue("object-version");
  remove.mockResolvedValue(undefined);
  storage.mockReturnValue({ put, remove });
});
describe("pending submission service", () => {
  it("stores only validated versioned answers with server-controlled pending state", async () => {
    const result = await submitSurvey(
      defaultSurvey.surveyId,
      defaultVersionId,
      sampleResources[0].answers,
    );
    expect(create).toHaveBeenCalledWith({
      data: {
        surveyId: defaultSurvey.surveyId,
        surveyVersionId: defaultVersionId,
        answers: sampleResources[0].answers,
        uploadedImageKey: null,
        status: "PENDING",
      },
    });
    expect(result).toEqual({
      message: defaultSurvey.closingMessage,
      status: "PENDING",
    });
    expect(storage).not.toHaveBeenCalled();
  });
  it("rejects missing/unpublished surveys and outdated forms before saving", async () => {
    published.mockRejectedValueOnce(
      new SurveyServiceError(404, "Not available"),
    );
    await expect(
      submitSurvey("missing", defaultVersionId, {}),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      submitSurvey(
        defaultSurvey.surveyId,
        "older-version",
        sampleResources[0].answers,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(create).not.toHaveBeenCalled();
  });
  it("returns field-specific errors without a database write or upload", async () => {
    await expect(
      submitSurvey(defaultSurvey.surveyId, defaultVersionId, {}),
    ).rejects.toMatchObject({
      status: 422,
      fieldErrors: { "practice-name": expect.any(String) },
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });
  it("stores a validated image key without returning it", async () => {
    const result = await submitSurvey(
      defaultSurvey.surveyId,
      defaultVersionId,
      sampleResources[0].answers,
      surveyImage(),
    );
    expect(put).toHaveBeenCalledWith(
      "pending/unit-test-image.png",
      expect.objectContaining({ contentType: "image/png" }),
    );
    expect(create.mock.calls[0][0].data.uploadedImageKey).toBe(
      "pending/unit-test-image.png",
    );
    expect(result).not.toHaveProperty("uploadedImageKey");
  });
  it("cleans up uploaded objects if saving fails", async () => {
    transaction.mockRejectedValue(new Error("private database details"));
    await expect(
      submitSurvey(
        defaultSurvey.surveyId,
        defaultVersionId,
        sampleResources[0].answers,
        surveyImage(),
      ),
    ).rejects.toMatchObject({ status: 503 });
    expect(remove).toHaveBeenCalledWith(
      "pending/unit-test-image.png",
      "object-version",
    );
  });
  it("does not save a response when storage fails, including an uncertain upload result", async () => {
    put.mockRejectedValue(new Error("private storage details"));
    await expect(
      submitSurvey(
        defaultSurvey.surveyId,
        defaultVersionId,
        sampleResources[0].answers,
        surveyImage(),
      ),
    ).rejects.toMatchObject({ status: 503 });
    expect(transaction).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith(
      "pending/unit-test-image.png",
      undefined,
    );
  });
  it("rechecks publication inside the locked transaction and cleans up stale uploads", async () => {
    published
      .mockResolvedValueOnce({
        versionId: defaultVersionId,
        snapshot: defaultSurvey,
      })
      .mockResolvedValueOnce({
        versionId: "newer-version",
        snapshot: defaultSurvey,
      });
    await expect(
      submitSurvey(
        defaultSurvey.surveyId,
        defaultVersionId,
        sampleResources[0].answers,
        surveyImage(),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(create).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
  });
});
