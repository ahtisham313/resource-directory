import assert from "node:assert/strict";
import type { PrismaClient } from "../src/generated/prisma/client";
import {
  defaultSurvey,
  defaultSurveyId,
  defaultVersionId,
} from "../prisma/seed-data/default-survey";
import { sampleResources } from "../prisma/seed-data/sample-resources";
import { surveySnapshotSchema } from "../src/modules/surveys/survey-snapshot";

export async function verifySeedData(db: PrismaClient, adminEmail: string) {
  const admin = await db.adminUser.findUniqueOrThrow({
    where: { email: adminEmail },
  });
  assert(
    admin.email === admin.email.trim().toLowerCase(),
    "Admin email must be normalized.",
  );
  assert(
    /^\$2[aby]\$12\$/.test(admin.passwordHash),
    "Admin password must use bcrypt cost 12.",
  );
  assert(["SUPER_ADMIN", "ADMIN"].includes(admin.role));
  assert(["ACTIVE", "INACTIVE"].includes(admin.status));
  const survey = await db.survey.findUniqueOrThrow({
    where: { id: defaultSurveyId },
    include: {
      sections: { orderBy: { order: "asc" } },
      fields: { include: { options: true } },
    },
  });
  assert.equal(survey.sections.length, 7);
  assert.equal(survey.fields.length, 29);
  assert.equal(new Set(survey.fields.map((field) => field.fieldKey)).size, 29);
  const expectedFields = defaultSurvey.sections.flatMap(
    (section) => section.fields,
  );
  for (const expected of expectedFields) {
    const actual = survey.fields.find(
      (field) => field.fieldKey === expected.fieldKey,
    );
    assert(actual, `Missing field ${expected.fieldKey}`);
    assert.equal(actual.required, expected.required);
    assert.equal(actual.fieldType, expected.fieldType);
    assert.deepEqual(
      actual.options
        .sort((a, b) => a.order - b.order)
        .map(({ value, label, kind }) => ({ value, label, kind })),
      expected.options.map(({ value, label, kind }) => ({
        value,
        label,
        kind,
      })),
    );
  }
  const version = await db.surveyVersion.findUniqueOrThrow({
    where: { id: defaultVersionId },
  });
  const snapshot = surveySnapshotSchema.parse(version.snapshot);
  assert.deepEqual(snapshot, defaultSurvey);
  assert.equal(version.versionNumber, 1);
  const resources = await db.resource.findMany({
    where: { id: { in: sampleResources.map((sample) => sample.id) } },
    include: {
      categories: { include: { category: true } },
      sourceResponse: true,
    },
  });
  assert.equal(resources.length, 10);
  for (const resource of resources) {
    assert(resource.categories.length > 0);
    assert.equal(
      resource.sourceResponse.surveyVersionId,
      resource.surveyVersionId,
    );
    assert.equal(resource.sourceResponse.status, "APPROVED");
    assert(resource.sourceResponse.reviewedAt);
    assert(
      resource.latitude !== null &&
        resource.latitude >= -90 &&
        resource.latitude <= 90,
    );
    assert(
      resource.longitude !== null &&
        resource.longitude >= -180 &&
        resource.longitude <= 180,
    );
    assert(resource.currentAnswers && resource.sourceResponse.answers);
  }
  const tables = await db.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  for (const table of [
    "AdminUser",
    "AdminInvitation",
    "Notification",
    "Survey",
    "SurveySection",
    "SurveyField",
    "SurveyFieldOption",
    "SurveyVersion",
    "SurveyResponse",
    "Resource",
    "Category",
    "ResourceCategory",
    "AnalyticsEvent",
    "AuditLog",
  ]) {
    assert(
      tables.some((row) => row.tablename === table),
      `Missing table ${table}`,
    );
  }
  return {
    models: 14,
    sections: survey.sections.length,
    fields: survey.fields.length,
    options: survey.fields.reduce(
      (count, field) => count + field.options.length,
      0,
    ),
    versions: await db.surveyVersion.count({
      where: { surveyId: defaultSurveyId },
    }),
    resources: resources.length,
    activeResources: resources.filter((resource) => resource.active).length,
    responses: await db.surveyResponse.count({
      where: { surveyId: defaultSurveyId },
    }),
  };
}
