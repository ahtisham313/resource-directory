import type { Prisma } from "@/generated/prisma/client";
import { surveySnapshotSchema } from "./survey-snapshot";

export async function snapshotFromDraft(
  db: Prisma.TransactionClient,
  surveyId: string,
) {
  const survey = await db.survey.findUniqueOrThrow({
    where: { id: surveyId },
    select: {
      id: true,
      title: true,
      introText: true,
      closingMessage: true,
      termsText: true,
      deadlineText: true,
      contactName: true,
      contactEmail: true,
      sections: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          order: true,
          fields: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              fieldKey: true,
              label: true,
              fieldType: true,
              helperText: true,
              placeholder: true,
              content: true,
              required: true,
              order: true,
              validationRules: true,
              displayMapping: true,
              allowsOther: true,
              allowsNA: true,
              options: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  value: true,
                  label: true,
                  order: true,
                  kind: true,
                },
              },
            },
          },
        },
      },
    },
  });
  const { id, ...definition } = survey;
  // Copy the definition, not live draft relations, into each published version.
  return surveySnapshotSchema.parse({
    schemaVersion: 1,
    surveyId: id,
    ...definition,
  });
}
