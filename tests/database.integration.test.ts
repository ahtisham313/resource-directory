import { randomBytes } from "node:crypto";
import { hash, compare } from "bcryptjs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "../src/lib/database-client";
import { seedDatabase } from "../prisma/seed-database";
import { verifySeedData } from "../scripts/verify-seed-data";
import {
  defaultSurveyId,
  defaultVersionId,
} from "../prisma/seed-data/default-survey";
import { sampleResources } from "../prisma/seed-data/sample-resources";
import { projectResource } from "../src/modules/resources/project-resource";
import { surveySnapshotSchema } from "../src/modules/surveys/survey-snapshot";

const connectionString = process.env.DATABASE_TEST_URL;
if (!connectionString)
  throw new Error("Run database integration tests with npm run test:db.");
const target = new URL(connectionString);
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
  !/^\/resource_directory_test_[a-f0-9]+$/.test(target.pathname)
) {
  throw new Error(
    "Database tests require a dedicated disposable local database.",
  );
}
const db = createDatabaseClient(connectionString);
const credentials = {
  email: "seed-admin@example.com",
  password: randomBytes(24).toString("hex"),
};

beforeAll(async () => {
  await seedDatabase(db, credentials);
});
afterAll(async () => {
  await db.$disconnect();
});

describe("database foundation", () => {
  it("stores all models and exact seed definitions with a working password hash", async () => {
    const counts = await verifySeedData(db, credentials.email);
    expect(counts).toMatchObject({
      models: 14,
      sections: 7,
      fields: 29,
      versions: 1,
      resources: 10,
      activeResources: 9,
      responses: 12,
    });
    const admin = await db.adminUser.findUniqueOrThrow({
      where: { email: credentials.email },
    });
    expect(await compare(credentials.password, admin.passwordHash)).toBe(true);
  });

  it("rejects duplicate emails, source responses, category links and invalid foreign keys", async () => {
    const admin = await db.adminUser.findUniqueOrThrow({
      where: { email: credentials.email },
    });
    await expect(
      db.adminUser.create({
        data: {
          name: "Duplicate",
          email: admin.email,
          passwordHash: admin.passwordHash,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      db.adminUser.create({
        data: {
          name: "Unnormalized",
          email: "UPPER@example.com",
          passwordHash: admin.passwordHash,
        },
      }),
    ).rejects.toThrow();
    const resource = await db.resource.findUniqueOrThrow({
      where: { id: sampleResources[0].id },
      include: { categories: true },
    });
    const version = await db.surveyVersion.findUniqueOrThrow({
      where: { id: defaultVersionId },
    });
    const duplicate = projectResource(
      version.snapshot,
      sampleResources[0].answers,
    );
    await expect(
      db.resource.create({
        data: {
          ...duplicate.data,
          sourceResponseId: resource.sourceResponseId,
          surveyVersionId: defaultVersionId,
          id: "duplicate-source",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      db.resourceCategory.create({ data: resource.categories[0] }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      db.notification.create({
        data: {
          recipientId: "missing-admin",
          type: "GENERAL",
          title: "Example",
          message: "Example",
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      db.resource.update({
        where: { id: resource.id },
        data: { latitude: 100 },
      }),
    ).rejects.toThrow();
  });

  it("prevents cross-survey published pointers and response/version pairs", async () => {
    const original = await db.survey.findUniqueOrThrow({
      where: { id: defaultSurveyId },
    });
    await db.survey.create({
      data: {
        id: "another-survey",
        title: "Another survey",
        introText: "",
        closingMessage: "",
        termsText: "",
      },
    });
    await expect(
      db.survey.update({
        where: { id: "another-survey" },
        data: {
          status: "PUBLISHED",
          publishedVersionId: original.publishedVersionId,
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.surveyResponse.create({
        data: {
          surveyId: "another-survey",
          surveyVersionId: defaultVersionId,
          answers: {},
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      db.survey.update({
        where: { id: "another-survey" },
        data: { status: "PUBLISHED" },
      }),
    ).rejects.toThrow();
  });

  it("keeps published snapshots and original submissions unchanged", async () => {
    const version = await db.surveyVersion.findUniqueOrThrow({
      where: { id: defaultVersionId },
    });
    await expect(
      db.surveyVersion.update({
        where: { id: version.id },
        data: { snapshot: {} },
      }),
    ).rejects.toThrow();
    await expect(
      db.surveyResponse.update({
        where: { id: sampleResources[0].responseId },
        data: { answers: {} },
      }),
    ).rejects.toThrow();
    await db.surveyField.update({
      where: {
        surveyId_fieldKey: {
          surveyId: defaultSurveyId,
          fieldKey: "practice-name",
        },
      },
      data: { label: "Edited draft label" },
    });
    const unchanged = await db.surveyVersion.findUniqueOrThrow({
      where: { id: version.id },
    });
    expect(unchanged.snapshot).toEqual(version.snapshot);
  });

  it("preserves admin passwords and published resource edits on repeated seeds", async () => {
    const admin = await db.adminUser.findUniqueOrThrow({
      where: { email: credentials.email },
    });
    const editedHash = await hash(randomBytes(24).toString("hex"), 12);
    await db.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash: editedHash },
    });
    const version = await db.surveyVersion.findUniqueOrThrow({
      where: { id: defaultVersionId },
    });
    const snapshot = surveySnapshotSchema.parse(version.snapshot);
    const answers = structuredClone(sampleResources[0].answers);
    answers["practice-name"] = { value: "Edited published practice" };
    const projection = projectResource(snapshot, answers);
    await db.resource.update({
      where: { id: sampleResources[0].id },
      data: { ...projection.data, active: false },
    });
    const countsBefore = [
      await db.adminUser.count(),
      await db.survey.count(),
      await db.surveyField.count(),
      await db.surveyFieldOption.count(),
      await db.resource.count(),
      await db.surveyResponse.count(),
      await db.category.count(),
      await db.resourceCategory.count(),
    ];
    await seedDatabase(db, credentials);
    const countsAfter = [
      await db.adminUser.count(),
      await db.survey.count(),
      await db.surveyField.count(),
      await db.surveyFieldOption.count(),
      await db.resource.count(),
      await db.surveyResponse.count(),
      await db.category.count(),
      await db.resourceCategory.count(),
    ];
    expect(countsAfter).toEqual(countsBefore);
    expect(
      (await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } }))
        .passwordHash === editedHash,
    ).toBe(true);
    const resource = await db.resource.findUniqueOrThrow({
      where: { id: sampleResources[0].id },
      include: { sourceResponse: true },
    });
    expect(resource.name).toBe("Edited published practice");
    expect(resource.active).toBe(false);
    expect(resource.currentAnswers).toEqual(answers);
    expect(resource.sourceResponse.answers).toEqual(sampleResources[0].answers);
  });
});
