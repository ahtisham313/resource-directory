import { randomUUID, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { getDb } from "../src/lib/db";
import { defaultSurvey } from "../prisma/seed-data/default-survey";
import { sampleResources } from "../prisma/seed-data/sample-resources";
import {
  approveResponse,
  rejectResponse,
} from "../src/modules/responses/review-mutations";

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
  throw new Error("Review tests require a disposable local database.");
const surveyId = `phase5-${randomUUID()}`,
  versionId = `phase5-version-${randomUUID()}`;
const snapshot = structuredClone(defaultSurvey);
snapshot.surveyId = surveyId;
snapshot.sections[0].fields[0].fieldKey = "custom-practice-title";
const categoryField = snapshot.sections[0].fields.find(
  (field) => field.displayMapping === "CATEGORY",
)!;
categoryField.options.find((option) => option.value === "primary-care")!.label =
  "Renamed Primary Care Label";
const answers = structuredClone(sampleResources[0].answers);
answers["custom-practice-title"] = answers["practice-name"];
delete answers["practice-name"];
answers.category = { value: ["primary-care", "urgent-care"] };
const coordinates = { latitude: 38.88, longitude: -77.1 };
let adminId: string;
async function pending(prefix = "phase5-review-") {
  return getDb().surveyResponse.create({
    data: {
      id: prefix + randomUUID(),
      surveyId,
      surveyVersionId: versionId,
      answers,
      status: "PENDING",
    },
  });
}
beforeAll(async () => {
  const admin = await getDb().adminUser.create({
    data: {
      name: "Review fixture",
      email: `review-${randomUUID()}@example.com`,
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
  await getDb().survey.create({
    data: {
      id: surveyId,
      title: snapshot.title,
      introText: snapshot.introText,
      closingMessage: snapshot.closingMessage,
      termsText: snapshot.termsText,
    },
  });
  await getDb().surveyVersion.create({
    data: { id: versionId, surveyId, versionNumber: 1, snapshot },
  });
  await getDb().survey.update({
    where: { id: surveyId },
    data: { status: "PUBLISHED", publishedVersionId: versionId },
  });
  for (const category of [
    { slug: "primary-care", name: "Primary Care" },
    { slug: "urgent-care", name: "Urgent Care" },
  ])
    await getDb().category.upsert({
      where: { slug: category.slug },
      create: category,
      update: {},
    });
});
afterAll(async () => {
  await getDb().$disconnect();
});

describe("transactional response review", () => {
  it("approves mapped historical answers once, preserves every category and original answer, and records reviewer and audit", async () => {
    const response = await pending();
    const result = await approveResponse(response.id, {
      note: "Verified information",
      coordinates,
    });
    const resource = await getDb().resource.findUniqueOrThrow({
      where: { sourceResponseId: response.id },
      include: { categories: { include: { category: true } } },
    });
    const reviewed = await getDb().surveyResponse.findUniqueOrThrow({
      where: { id: response.id },
    });
    expect(result.status).toBe("APPROVED");
    expect(resource).toMatchObject({
      active: true,
      name: answers["custom-practice-title"].value,
      surveyVersionId: versionId,
      currentAnswers: answers,
      ...coordinates,
    });
    expect(
      resource.categories.map((link) => link.category.slug).sort(),
    ).toEqual(["primary-care", "urgent-care"]);
    expect(reviewed).toMatchObject({
      answers,
      status: "APPROVED",
      reviewerId: adminId,
      reviewNote: "Verified information",
    });
    expect(reviewed.reviewedAt).toBeInstanceOf(Date);
    expect(
      await getDb().auditLog.count({
        where: { entityId: response.id, action: "APPROVE_RESPONSE", adminId },
      }),
    ).toBe(1);
    expect(
      (
        await approveResponse(response.id, {
          note: "Should not overwrite",
          coordinates,
        })
      ).alreadyReviewed,
    ).toBe(true);
    expect(
      (
        await getDb().surveyResponse.findUniqueOrThrow({
          where: { id: response.id },
        })
      ).reviewNote,
    ).toBe("Verified information");
    await expect(rejectResponse(response.id, {})).rejects.toMatchObject({
      status: 409,
    });
    const sameAddress = await pending();
    await approveResponse(sameAddress.id, {});
    expect(
      await getDb().resource.findUniqueOrThrow({
        where: { sourceResponseId: sameAddress.id },
      }),
    ).toMatchObject(coordinates);
  });

  it("allows exactly one resource and one decision under concurrent approval or competing rejection", async () => {
    const response = await pending();
    const results = await Promise.all([
      approveResponse(response.id, { coordinates }),
      approveResponse(response.id, { coordinates }),
    ]);
    expect(results.filter((result) => !result.alreadyReviewed)).toHaveLength(1);
    expect(
      await getDb().resource.count({
        where: { sourceResponseId: response.id },
      }),
    ).toBe(1);
    expect(
      await getDb().auditLog.count({ where: { entityId: response.id } }),
    ).toBe(1);
    const contested = await pending();
    const decisions = await Promise.allSettled([
      approveResponse(contested.id, { coordinates }),
      rejectResponse(contested.id, { note: "Not suitable" }),
    ]);
    expect(
      decisions.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const stored = await getDb().surveyResponse.findUniqueOrThrow({
      where: { id: contested.id },
    });
    expect(
      await getDb().resource.count({
        where: { sourceResponseId: contested.id },
      }),
    ).toBe(stored.status === "APPROVED" ? 1 : 0);
    expect(
      await getDb().auditLog.count({ where: { entityId: contested.id } }),
    ).toBe(1);
  });

  it("rolls back response, resource, and categories when audit recording fails; rejection never creates a resource", async () => {
    const response = await pending("phase5-rollback-");
    await getDb()
      .$executeRaw`CREATE FUNCTION fail_phase5_review_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityId" LIKE 'phase5-rollback-%' THEN RAISE EXCEPTION 'Injected review audit failure'; END IF; RETURN NEW; END; $$`;
    await getDb()
      .$executeRaw`CREATE TRIGGER phase5_review_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION fail_phase5_review_audit()`;
    try {
      await expect(
        approveResponse(response.id, { coordinates }),
      ).rejects.toThrow();
      expect(
        await getDb().resource.count({
          where: { sourceResponseId: response.id },
        }),
      ).toBe(0);
      expect(
        await getDb().auditLog.count({ where: { entityId: response.id } }),
      ).toBe(0);
      expect(
        await getDb().surveyResponse.findUniqueOrThrow({
          where: { id: response.id },
        }),
      ).toMatchObject({
        status: "PENDING",
        reviewerId: null,
        reviewedAt: null,
        answers,
      });
    } finally {
      await getDb()
        .$executeRaw`DROP TRIGGER phase5_review_audit_failure ON "AuditLog"`;
      await getDb().$executeRaw`DROP FUNCTION fail_phase5_review_audit()`;
    }
    const rejected = await pending();
    await rejectResponse(rejected.id, { note: "Outside scope" });
    expect(
      (await rejectResponse(rejected.id, { note: "Ignored retry" }))
        .alreadyReviewed,
    ).toBe(true);
    expect(
      await getDb().resource.count({
        where: { sourceResponseId: rejected.id },
      }),
    ).toBe(0);
    expect(
      await getDb().auditLog.count({
        where: { entityId: rejected.id, action: "REJECT_RESPONSE" },
      }),
    ).toBe(1);
    expect(
      await getDb().surveyResponse.findUniqueOrThrow({
        where: { id: rejected.id },
      }),
    ).toMatchObject({
      status: "REJECTED",
      reviewerId: adminId,
      reviewNote: "Outside scope",
      answers,
    });
  });
});
