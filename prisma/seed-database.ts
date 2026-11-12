import { hash } from "bcryptjs";
import { z } from "zod";
import type { PrismaClient } from "../src/generated/prisma/client";
import {
  defaultCategories,
  defaultSurvey,
  defaultSurveyId,
  defaultVersionId,
} from "./seed-data/default-survey";
import { sampleResources } from "./seed-data/sample-resources";
import { snapshotFromDraft } from "../src/modules/surveys/snapshot-from-draft";
import { projectResource } from "../src/modules/resources/project-resource";
import {
  surveySnapshotSchema,
  validateSurveyAnswers,
} from "../src/modules/surveys/survey-snapshot";

export const seedCredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z
    .string()
    .min(12)
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "bcrypt passwords must not exceed 72 bytes.",
    ),
  name: z.string().trim().min(1).default("Directory Administrator"),
});

export async function seedDatabase(
  db: PrismaClient,
  credentialsInput: unknown,
) {
  const credentials = seedCredentialsSchema.parse(credentialsInput);
  const existing = await db.adminUser.findUnique({
    where: { email: credentials.email },
    select: { id: true },
  });
  const passwordHash = existing
    ? undefined
    : await hash(credentials.password, 12);

  return db.$transaction(
    async (tx) => {
      // Concurrent seeds serialize without replacing existing administrator passwords or edits.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(78234190)`;
      let admin = await tx.adminUser.findUnique({
        where: { email: credentials.email },
      });
      if (!admin) {
        if (!passwordHash)
          throw new Error(
            "Administrator changed during seeding. Retry the seed.",
          );
        admin = await tx.adminUser.create({
          data: {
            email: credentials.email,
            name: credentials.name,
            passwordHash,
            role: "SUPER_ADMIN",
            status: "ACTIVE",
          },
        });
      }

      const survey = await tx.survey.findUnique({
        where: { id: defaultSurveyId },
      });
      if (!survey) {
        const { sections, surveyId: id } = defaultSurvey;
        await tx.survey.create({
          data: {
            id,
            title: defaultSurvey.title,
            introText: defaultSurvey.introText,
            closingMessage: defaultSurvey.closingMessage,
            termsText: defaultSurvey.termsText,
            deadlineText: defaultSurvey.deadlineText,
            contactName: defaultSurvey.contactName,
            contactEmail: defaultSurvey.contactEmail,
            status: "DRAFT",
          },
        });
        for (const section of sections) {
          await tx.surveySection.create({
            data: {
              id: section.id,
              surveyId: id,
              title: section.title,
              order: section.order,
            },
          });
          for (const field of section.fields) {
            const { options, ...definition } = field;
            await tx.surveyField.create({
              data: {
                ...definition,
                surveyId: id,
                sectionId: section.id,
                options: { create: options },
              },
            });
          }
        }
        const snapshot = await snapshotFromDraft(tx, id);
        await tx.surveyVersion.create({
          data: {
            id: defaultVersionId,
            surveyId: id,
            versionNumber: 1,
            snapshot,
          },
        });
        await tx.survey.update({
          where: { id },
          data: { status: "PUBLISHED", publishedVersionId: defaultVersionId },
        });
      }

      const version = await tx.surveyVersion.findUnique({
        where: { id: defaultVersionId },
      });
      if (!version)
        throw new Error(
          "The seeded survey has no initial published version; inspect it before reseeding.",
        );
      const snapshot = surveySnapshotSchema.parse(version.snapshot);

      for (const category of defaultCategories) {
        await tx.category.upsert({
          where: { slug: category.slug },
          update: {},
          create: category,
        });
      }
      const categoryRows = await tx.category.findMany({
        where: {
          slug: { in: defaultCategories.map((category) => category.slug) },
        },
      });

      for (const sample of sampleResources) {
        if (
          await tx.resource.findUnique({
            where: { id: sample.id },
            select: { id: true },
          })
        )
          continue;
        // A removed demo response is not recreated over a later administrator decision.
        const responseExists = await tx.surveyResponse.findUnique({
          where: { id: sample.responseId },
          select: { id: true },
        });
        if (responseExists) continue;
        const answers = validateSurveyAnswers(snapshot, sample.answers);
        const projection = projectResource(snapshot, answers);
        const categoryIds = projection.categoryNames.map((name) => {
          const category = categoryRows.find((row) => row.name === name);
          if (!category)
            throw new Error(`Seed category is unavailable: ${name}`);
          return category.id;
        });
        await tx.surveyResponse.create({
          data: {
            id: sample.responseId,
            surveyId: defaultSurveyId,
            surveyVersionId: defaultVersionId,
            answers,
            status: "APPROVED",
            reviewerId: admin.id,
            reviewedAt: new Date(),
            reviewNote: "Fictional seed data.",
          },
        });
        await tx.resource.create({
          data: {
            id: sample.id,
            sourceResponseId: sample.responseId,
            surveyVersionId: defaultVersionId,
            ...projection.data,
            latitude: sample.latitude,
            longitude: sample.longitude,
            active: sample.active,
            categories: {
              create: categoryIds.map((categoryId) => ({ categoryId })),
            },
          },
        });
      }

      for (const [id, status] of [
        ["seed-pending-response", "PENDING"],
        ["seed-rejected-response", "REJECTED"],
      ] as const) {
        if (
          await tx.surveyResponse.findUnique({
            where: { id },
            select: { id: true },
          })
        )
          continue;
        const answers = validateSurveyAnswers(
          snapshot,
          sampleResources[0].answers,
        );
        await tx.surveyResponse.create({
          data: {
            id,
            surveyId: defaultSurveyId,
            surveyVersionId: defaultVersionId,
            answers,
            status,
            ...(status === "REJECTED"
              ? {
                  reviewerId: admin.id,
                  reviewedAt: new Date(),
                  reviewNote: "Fictional rejected example.",
                }
              : {}),
          },
        });
      }
      return {
        surveyId: defaultSurveyId,
        versionId: defaultVersionId,
        sampleResourceCount: sampleResources.length,
      };
    },
    { timeout: 30000, maxWait: 10000 },
  );
}
