import { randomUUID, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { getDb } from "../src/lib/db";
import {
  defaultSurvey,
  defaultCategories,
} from "../prisma/seed-data/default-survey";
import { sampleResources } from "../prisma/seed-data/sample-resources";
import {
  createSurvey,
  getSurveyEditor,
  saveSurveyDraft,
  publishSurvey,
  unpublishSurvey,
  duplicateSurvey,
  deleteSurvey,
} from "../src/modules/surveys/builder-service";
import { getPublishedSurvey } from "../src/modules/surveys/published-survey";
import { submitSurvey } from "../src/modules/surveys/submit-survey";
import { approveResponse } from "../src/modules/responses/review-mutations";
import { getPublicResource } from "../src/modules/resources/resource-details";
import { normalizeDraft } from "../src/modules/surveys/builder-draft";

const { currentAdmin } = vi.hoisted(() => ({ currentAdmin: vi.fn() }));
vi.mock("@/modules/auth/authorization", async (original) => ({
  ...(await original<typeof import("../src/modules/auth/authorization")>()),
  requireAdmin: currentAdmin,
}));
const url = process.env.DATABASE_TEST_URL;
if (!url || url !== process.env.DATABASE_URL)
  throw new Error("Run with npm run test:db.");
const target = new URL(url);
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
  !/^\/resource_directory_test_[a-f0-9]+$/.test(target.pathname)
)
  throw new Error("Builder tests require a disposable local database.");
let adminId: string;
beforeAll(async () => {
  const admin = await getDb().adminUser.create({
    data: {
      name: "Builder fixture",
      email: `builder-${randomUUID()}@example.com`,
      passwordHash: await hash(randomBytes(24).toString("hex"), 4),
      status: "ACTIVE",
      role: "ADMIN",
    },
  });
  adminId = admin.id;
  currentAdmin.mockResolvedValue({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
  });
  for (const category of defaultCategories)
    await getDb().category.upsert({
      where: { slug: category.slug },
      create: category,
      update: {},
    });
});
afterAll(async () => {
  await getDb().$disconnect();
});
async function ready(title = `Builder ${randomUUID()}`) {
  const { id } = await createSurvey({ title });
  const blank = await getSurveyEditor(id);
  const definition = structuredClone(defaultSurvey);
  definition.surveyId = id;
  definition.title = title;
  for (const section of definition.sections) {
    section.id = randomUUID();
    for (const field of section.fields) {
      field.id = randomUUID();
      for (const option of field.options) option.id = randomUUID();
    }
  }
  return saveSurveyDraft(id, { revision: blank.revision, definition });
}

it("keeps live versions and approved resources unchanged through draft edits, republishing, duplication, unpublishing, and archival", async () => {
  let editor = await ready();
  const id = editor.definition.surveyId;
  await publishSurvey(id, { revision: editor.revision });
  const v1 = await getPublishedSurvey(id);
  await submitSurvey(id, v1.versionId, sampleResources[0].answers);
  const oldPending = await getDb().surveyResponse.findFirstOrThrow({
    where: { surveyId: id },
  });
  await submitSurvey(id, v1.versionId, sampleResources[1].answers);
  const firstApproved = await getDb().surveyResponse.findFirstOrThrow({
    where: { surveyId: id, id: { not: oldPending.id } },
  });
  await approveResponse(firstApproved.id, {
    coordinates: { latitude: 38.88, longitude: -77.1 },
  });
  const resourceBefore = await getDb().resource.findUniqueOrThrow({
    where: { sourceResponseId: firstApproved.id },
  });
  editor = await getSurveyEditor(id);
  const next = structuredClone(editor.definition);
  next.title = "New draft title";
  next.sections[0].fields[0].label = "Changed future title label";
  next.sections[0].fields.push({
    ...next.sections[5].fields[0],
    id: randomUUID(),
    fieldKey: "new-builder-question",
    label: "A new optional question",
    required: false,
    displayMapping: null,
    order: 999,
  });
  editor = await saveSurveyDraft(id, {
    revision: editor.revision,
    definition: normalizeDraft(next),
  });
  expect(await getPublishedSurvey(id)).toEqual(v1);
  expect(
    await getDb().resource.findUniqueOrThrow({
      where: { id: resourceBefore.id },
    }),
  ).toEqual(resourceBefore);
  await publishSurvey(id, { revision: editor.revision });
  const v2 = await getPublishedSurvey(id);
  expect(v2.versionId).not.toBe(v1.versionId);
  expect(
    v2.snapshot.sections.flatMap((section) => section.fields),
  ).toHaveLength(30);
  await expect(
    submitSurvey(id, v1.versionId, sampleResources[0].answers),
  ).rejects.toMatchObject({ status: 409 });
  await submitSurvey(id, v2.versionId, sampleResources[2].answers);
  expect(
    await getDb().surveyResponse.count({
      where: { surveyId: id, surveyVersionId: v2.versionId },
    }),
  ).toBe(1);
  await approveResponse(oldPending.id, {
    coordinates: { latitude: 38.88, longitude: -77.1 },
  });
  const oldResource = await getDb().resource.findUniqueOrThrow({
    where: { sourceResponseId: oldPending.id },
  });
  expect(oldResource.surveyVersionId).toBe(v1.versionId);
  const detail = await getPublicResource(oldResource.id);
  expect(detail.sections.flatMap((section) => section.fields)).toHaveLength(29);
  expect(detail.sections[0].fields[0].label).toBe(
    v1.snapshot.sections[0].fields[0].label,
  );
  expect(
    (
      await getDb().surveyResponse.findUniqueOrThrow({
        where: { id: oldPending.id },
      })
    ).answers,
  ).toEqual(oldPending.answers);
  editor = await getSurveyEditor(id);
  const copy = await duplicateSurvey(id, { revision: editor.revision }),
    copied = await getSurveyEditor(copy.id);
  expect(copied.status).toBe("DRAFT");
  expect(copied.publishedVersion).toBeNull();
  expect(copied.definition.sections[0].fields[0].id).not.toBe(
    editor.definition.sections[0].fields[0].id,
  );
  expect(copied.definition.sections[0].fields[0].fieldKey).toBe(
    editor.definition.sections[0].fields[0].fieldKey,
  );
  expect(
    await getDb().surveyResponse.count({ where: { surveyId: copy.id } }),
  ).toBe(0);
  await deleteSurvey(copy.id, { revision: copied.revision });
  expect(
    await getDb().survey.findUnique({ where: { id: copy.id } }),
  ).toBeNull();
  await unpublishSurvey(id, { revision: editor.revision });
  await expect(getPublishedSurvey(id)).rejects.toMatchObject({ status: 404 });
  await expect(
    submitSurvey(id, v2.versionId, sampleResources[0].answers),
  ).rejects.toMatchObject({ status: 404 });
  expect((await getPublicResource(oldResource.id)).resource.id).toBe(
    oldResource.id,
  );
  editor = await getSurveyEditor(id);
  await publishSurvey(id, { revision: editor.revision });
  editor = await getSurveyEditor(id);
  expect(editor.publishedVersion).toBe(3);
  expect((await deleteSurvey(id, { revision: editor.revision })).archived).toBe(
    true,
  );
  await expect(getSurveyEditor(id)).rejects.toMatchObject({ status: 404 });
  expect((await getPublicResource(oldResource.id)).resource.id).toBe(
    oldResource.id,
  );
  expect(
    (
      await getDb().surveyVersion.findUniqueOrThrow({
        where: { id: v1.versionId },
      })
    ).snapshot,
  ).toEqual(v1.snapshot);
  const logs = await getDb().auditLog.findMany({ where: { entityId: id } });
  expect(logs.filter((log) => log.action === "PUBLISH_SURVEY")).toHaveLength(3);
  expect(logs.some((log) => log.action === "UNPUBLISH_SURVEY")).toBe(true);
  expect(logs.some((log) => log.action === "ARCHIVE_SURVEY")).toBe(true);
  expect(JSON.stringify(logs.map((log) => log.metadata))).not.toContain(
    "sections",
  );
});

it("rejects missing mappings, changed field keys, foreign identifiers, stale saves, disabled admins, and competing publications", async () => {
  let editor = await ready();
  const id = editor.definition.surveyId;
  const invalid = structuredClone(editor.definition);
  invalid.sections
    .flatMap((section) => section.fields)
    .find((field) => field.displayMapping === "CITY")!.displayMapping = null;
  editor = await saveSurveyDraft(id, {
    revision: editor.revision,
    definition: invalid,
  });
  await expect(
    publishSurvey(id, { revision: editor.revision }),
  ).rejects.toMatchObject({ status: 422 });
  expect(await getDb().surveyVersion.count({ where: { surveyId: id } })).toBe(
    0,
  );
  invalid.sections
    .flatMap((section) => section.fields)
    .find((field) => field.fieldKey === "city")!.displayMapping = "CITY";
  editor = await saveSurveyDraft(id, {
    revision: editor.revision,
    definition: invalid,
  });
  const revision = editor.revision;
  const results = await Promise.allSettled([
    publishSurvey(id, { revision }),
    publishSurvey(id, { revision }),
  ]);
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  expect(results.find((result) => result.status === "rejected")).toMatchObject({
    reason: { status: 409 },
  });
  expect(await getDb().surveyVersion.count({ where: { surveyId: id } })).toBe(
    1,
  );
  await expect(
    saveSurveyDraft(id, { revision, definition: editor.definition }),
  ).rejects.toMatchObject({ status: 409 });
  editor = await getSurveyEditor(id);
  const changed = structuredClone(editor.definition);
  changed.sections[0].fields[0].fieldKey = "tampered-key";
  await expect(
    saveSurveyDraft(id, { revision: editor.revision, definition: changed }),
  ).rejects.toMatchObject({ status: 422 });
  const foreign = await ready();
  const malicious = structuredClone(editor.definition);
  malicious.sections[0].id = foreign.definition.sections[0].id;
  await expect(
    saveSurveyDraft(id, { revision: editor.revision, definition: malicious }),
  ).rejects.toMatchObject({ status: 422 });
  await getDb().adminUser.update({
    where: { id: adminId },
    data: { status: "INACTIVE" },
  });
  try {
    await expect(
      createSurvey({ title: "Disabled account" }),
    ).rejects.toMatchObject({ status: 401 });
  } finally {
    await getDb().adminUser.update({
      where: { id: adminId },
      data: { status: "ACTIVE" },
    });
  }
});

it("rolls back a new version and its public pointer if publication audit recording fails", async () => {
  const editor = await ready("Phase 7 rollback fixture"),
    id = editor.definition.surveyId;
  await getDb()
    .$executeRaw`CREATE FUNCTION fail_builder_publication_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'PUBLISH_SURVEY' AND EXISTS(SELECT 1 FROM "Survey" WHERE id = NEW."entityId" AND title = 'Phase 7 rollback fixture') THEN RAISE EXCEPTION 'Injected publication audit failure'; END IF; RETURN NEW; END; $$`;
  await getDb()
    .$executeRaw`CREATE TRIGGER builder_publication_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION fail_builder_publication_audit()`;
  try {
    await expect(
      publishSurvey(id, { revision: editor.revision }),
    ).rejects.toThrow();
    expect(
      await getDb().survey.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject({ status: "DRAFT", publishedVersionId: null });
    expect(await getDb().surveyVersion.count({ where: { surveyId: id } })).toBe(
      0,
    );
    expect(
      await getDb().auditLog.count({
        where: { entityId: id, action: "PUBLISH_SURVEY" },
      }),
    ).toBe(0);
  } finally {
    await getDb()
      .$executeRaw`DROP TRIGGER builder_publication_audit_failure ON "AuditLog"`;
    await getDb().$executeRaw`DROP FUNCTION fail_builder_publication_audit()`;
  }
});
