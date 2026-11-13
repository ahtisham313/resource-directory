import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "../src/lib/db";
import { defaultSurvey } from "../prisma/seed-data/default-survey";
import { sampleResources } from "../prisma/seed-data/sample-resources";
import { getPublishedSurvey } from "../src/modules/surveys/published-survey";
import { submitSurvey } from "../src/modules/surveys/submit-survey";
import { surveyImage } from "./fixtures/survey-images";

const { put, remove } = vi.hoisted(() => ({ put: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/image-storage", () => ({
  createImageKey: () => `pending/${randomUUID()}.png`,
  getImageStorage: () => ({ put, remove }),
}));
const connection = process.env.DATABASE_TEST_URL;
if (!connection || connection !== process.env.DATABASE_URL)
  throw new Error("Run with npm run test:db.");
const target = new URL(connection);
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
  !/^\/resource_directory_test_[a-f0-9]+$/.test(target.pathname)
)
  throw new Error("A disposable local test database is required.");
const id = `phase4-${randomUUID()}`,
  version = `phase4-version-${randomUUID()}`;
const snapshot = { ...defaultSurvey, surveyId: id };
beforeAll(async () => {
  await getDb().survey.create({
    data: {
      id,
      title: snapshot.title,
      introText: snapshot.introText,
      closingMessage: snapshot.closingMessage,
      termsText: snapshot.termsText,
    },
  });
  await getDb().surveyVersion.create({
    data: { id: version, surveyId: id, versionNumber: 1, snapshot },
  });
  await getDb().survey.update({
    where: { id },
    data: { status: "PUBLISHED", publishedVersionId: version },
  });
  put.mockResolvedValue(undefined);
  remove.mockResolvedValue(undefined);
});
afterAll(async () => {
  await getDb().$disconnect();
});
describe("public survey persistence", () => {
  it("loads the published 29-item snapshot and stores PENDING answers against its exact version", async () => {
    const published = await getPublishedSurvey(id);
    expect(published.snapshot.sections).toHaveLength(7);
    expect(published.snapshot.sections.flatMap((s) => s.fields)).toHaveLength(
      29,
    );
    const resourcesBefore = await getDb().resource.count();
    const result = await submitSurvey(id, version, sampleResources[0].answers);
    const response = await getDb().surveyResponse.findFirstOrThrow({
      where: { surveyId: id },
    });
    expect(response).toMatchObject({
      status: "PENDING",
      surveyVersionId: version,
      reviewerId: null,
      reviewedAt: null,
      uploadedImageKey: null,
      answers: sampleResources[0].answers,
    });
    expect(result.status).toBe("PENDING");
    expect(await getDb().resource.count()).toBe(resourcesBefore);
  });
  it("does not save invalid, missing, unpublished, deleted or outdated submissions", async () => {
    const before = await getDb().surveyResponse.count({
      where: { surveyId: id },
    });
    await expect(submitSurvey(id, version, {})).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      submitSurvey("missing", version, sampleResources[0].answers),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      submitSurvey(id, "outdated-version", sampleResources[0].answers),
    ).rejects.toMatchObject({ status: 409 });
    await getDb().survey.update({ where: { id }, data: { status: "DRAFT" } });
    await expect(
      submitSurvey(id, version, sampleResources[0].answers),
    ).rejects.toMatchObject({ status: 404 });
    await getDb().survey.update({
      where: { id },
      data: { status: "PUBLISHED", deletedAt: new Date() },
    });
    await expect(
      submitSurvey(id, version, sampleResources[0].answers),
    ).rejects.toMatchObject({ status: 404 });
    await getDb().survey.update({ where: { id }, data: { deletedAt: null } });
    expect(
      await getDb().surveyResponse.count({ where: { surveyId: id } }),
    ).toBe(before);
  });
  it("stores only verified uploaded image keys and does not save failed uploads", async () => {
    const before = await getDb().surveyResponse.count({
      where: { surveyId: id },
    });
    put.mockRejectedValueOnce(new Error("Storage unavailable"));
    await expect(
      submitSurvey(id, version, sampleResources[0].answers, surveyImage()),
    ).rejects.toMatchObject({ status: 503 });
    expect(
      await getDb().surveyResponse.count({ where: { surveyId: id } }),
    ).toBe(before);
    expect(remove).toHaveBeenCalled();
    await submitSurvey(
      id,
      version,
      sampleResources[0].answers,
      surveyImage("png", "../../unsafe.png"),
    );
    const rows = await getDb().surveyResponse.findMany({
      where: { surveyId: id, uploadedImageKey: { not: null } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].uploadedImageKey).toMatch(/^pending\/[a-f0-9-]+\.png$/);
  });
  it("keeps the original version unchanged after a new publication", async () => {
    const nextVersion = `phase4-next-${randomUUID()}`;
    await getDb().surveyVersion.create({
      data: {
        id: nextVersion,
        surveyId: id,
        versionNumber: 2,
        snapshot: { ...snapshot, title: "Updated title" },
      },
    });
    await getDb().survey.update({
      where: { id },
      data: { publishedVersionId: nextVersion },
    });
    await expect(
      submitSurvey(id, version, sampleResources[0].answers),
    ).rejects.toMatchObject({ status: 409 });
    const original = await getDb().surveyVersion.findUniqueOrThrow({
      where: { id: version },
    });
    expect(original.snapshot).toEqual(snapshot);
    expect((await getPublishedSurvey(id)).versionId).toBe(nextVersion);
  });
});
