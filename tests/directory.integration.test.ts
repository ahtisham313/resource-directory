import { randomUUID, createHash } from "node:crypto";
import { beforeAll, afterAll, expect, it } from "vitest";
import { getDb } from "../src/lib/db";
import { defaultSurvey } from "../prisma/seed-data/default-survey";
import { sampleResources } from "../prisma/seed-data/sample-resources";
import { projectResource } from "../src/modules/resources/project-resource";
import { queryDirectory } from "../src/modules/resources/directory-query";
import { getPublicResource } from "../src/modules/resources/resource-details";

const url = process.env.DATABASE_TEST_URL;
if (!url || url !== process.env.DATABASE_URL)
  throw new Error("Run with npm run test:db.");
const target = new URL(url);
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
  !/^\/resource_directory_test_[a-f0-9]+$/.test(target.pathname)
)
  throw new Error("Directory tests require a disposable local database.");
const marker = `directory-${randomUUID()}`;
const surveyId = marker,
  versionId = `${marker}-version`;
const ids = Array.from(
  { length: 14 },
  (_, index) => `${marker}-${String(index).padStart(2, "0")}`,
);
const snapshot = structuredClone(defaultSurvey);
snapshot.surveyId = surveyId;
snapshot.sections[5].fields.push({
  ...snapshot.sections[5].fields[0],
  id: `${marker}-field`,
  fieldKey: "custom-directory-answer",
  label: "An added published question",
  order: 2,
});

beforeAll(async () => {
  const db = getDb();
  await db.survey.create({
    data: {
      id: surveyId,
      title: "Directory test",
      introText: "",
      closingMessage: "",
      termsText: "",
    },
  });
  await db.surveyVersion.create({
    data: { id: versionId, surveyId, versionNumber: 1, snapshot },
  });
  const categories = await Promise.all([
    db.category.upsert({
      where: { slug: "primary-care" },
      create: { slug: "primary-care", name: "Primary Care" },
      update: {},
    }),
    db.category.upsert({
      where: { slug: "urgent-care" },
      create: { slug: "urgent-care", name: "Urgent Care" },
      update: {},
    }),
  ]);
  for (const [index, id] of ids.entries()) {
    const answers = structuredClone(sampleResources[0].answers);
    answers["practice-name"] = {
      value: `${marker} Practice ${String(index).padStart(2, "0")}`,
    };
    answers.category = { value: ["primary-care", "urgent-care"] };
    answers["custom-directory-answer"] = {
      value: "Current approved answer <script>literal text</script>",
    };
    const original = {
      ...answers,
      "custom-directory-answer": { value: "Original submission answer" },
    };
    await db.surveyResponse.create({
      data: {
        id: `${id}-response`,
        surveyId,
        surveyVersionId: versionId,
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewNote: "Private review note",
        answers: original,
      },
    });
    await db.resource.create({
      data: {
        ...projectResource(snapshot, answers).data,
        id,
        sourceResponseId: `${id}-response`,
        surveyVersionId: versionId,
        active: index !== 13,
        latitude: index === 12 ? null : 0,
        longitude: index === 12 ? null : index,
        categories: {
          create: categories.map((category) => ({ categoryId: category.id })),
        },
      },
    });
  }
});
afterAll(async () => {
  await getDb().resource.deleteMany({ where: { id: { in: ids } } });
  await getDb().surveyResponse.deleteMany({ where: { surveyId } });
  await getDb().$disconnect();
});

it("filters active records once per resource and orders the full matching set before paginating, including deterministic daily order and distance", async () => {
  const base = { search: marker, category: "urgent-care" };
  const first = await queryDirectory({ ...base, sort: "az" });
  const second = await queryDirectory({ ...base, sort: "az", page: 2 });
  expect(first.total).toBe(13);
  expect(first.resources.map((row) => row.id)).toEqual(ids.slice(0, 10));
  expect(second.resources.map((row) => row.id)).toEqual(ids.slice(10, 13));
  expect(
    (await queryDirectory({ ...base, sort: "za" })).resources.map(
      (row) => row.id,
    ),
  ).toEqual(ids.slice(0, 13).reverse().slice(0, 10));
  for (const date of ["2026-11-13", "2026-11-14"]) {
    const expected = ids.slice(0, 13).sort((a, b) =>
      createHash("md5")
        .update(`${date}:${a}`)
        .digest("hex")
        .localeCompare(createHash("md5").update(`${date}:${b}`).digest("hex")),
    );
    const result = await queryDirectory(
      base,
      null,
      new Date(`${date}T12:00:00Z`),
    );
    expect(result.resources.map((row) => row.id)).toEqual(
      expected.slice(0, 10),
    );
    expect(
      (
        await queryDirectory(base, null, new Date(`${date}T23:59:00Z`))
      ).resources.map((row) => row.id),
    ).toEqual(expected.slice(0, 10));
  }
  const nearest = await queryDirectory(
    { ...base, sort: "nearest" },
    { latitude: 0, longitude: 0 },
  );
  expect(nearest.resources.map((row) => row.id)).toEqual(ids.slice(0, 10));
  expect(nearest.resources[0].distanceMiles).toBe(0);
  expect(nearest.resources[1].distanceMiles).toBeCloseTo(69.0934, 3);
  const farthest = await queryDirectory(
    { ...base, sort: "farthest" },
    { latitude: 0, longitude: 0 },
  );
  expect(farthest.resources[0].id).toBe(ids[11]);
  const last = await queryDirectory(
    { ...base, sort: "farthest", page: 2 },
    { latitude: 0, longitude: 0 },
  );
  expect(last.resources.at(-1)).toMatchObject({
    id: ids[12],
    distanceMiles: null,
  });
  expect(JSON.stringify(first)).not.toMatch(
    /currentAnswers|sourceResponse|reviewNote|reviewerId|imageKey/,
  );
});

it("returns current approved dynamic answers without review data and denies inactive details immediately", async () => {
  const details = await getPublicResource(ids[0]);
  const answer = details.sections
    .flatMap((section) => section.fields)
    .find((field) => field.key === "custom-directory-answer");
  expect(answer?.text).toContain("Current approved answer");
  expect(JSON.stringify(details)).not.toMatch(
    /Private review note|Original submission answer|reviewerId|sourceResponseId/,
  );
  await getDb().resource.update({
    where: { id: ids[0] },
    data: { active: false },
  });
  await expect(getPublicResource(ids[0])).rejects.toMatchObject({
    status: 404,
  });
  expect((await queryDirectory({ search: marker })).total).toBe(12);
  await expect(getPublicResource(ids[13])).rejects.toMatchObject({
    status: 404,
  });
});
