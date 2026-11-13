import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { projectResource } from "@/modules/resources/project-resource";
import type {
  SurveySnapshot,
  SurveyAnswers,
} from "@/modules/surveys/survey-snapshot";
import { ReviewError } from "./review-types";

export function prepareApprovedResource(
  snapshot: SurveySnapshot,
  answers: SurveyAnswers,
  imageKey: string | null,
) {
  try {
    const projection = projectResource(snapshot, answers, Boolean(imageKey));
    const categories = snapshot.sections
      .flatMap((section) => section.fields)
      .filter((field) => field.displayMapping === "CATEGORY")
      .flatMap((field) => {
        const answer = answers[field.fieldKey];
        if (!answer || answer.notApplicable || answer.value === null) return [];
        const values = Array.isArray(answer.value)
          ? answer.value
          : [answer.value];
        return values.flatMap((value) => {
          const option = field.options.find((option) => option.value === value);
          if (option?.kind === "NA") return [];
          const label =
            option?.kind === "OTHER"
              ? answer.otherText?.trim()
              : (option?.label ?? String(value));
          return label
            ? [
                {
                  value: option?.kind === "OTHER" ? label : String(value),
                  label,
                },
              ]
            : [];
        });
      });
    return { data: { ...projection.data, imageKey }, categories };
  } catch (error) {
    const mapping =
      error instanceof Error
        ? /^Missing resource mapping: ([A-Z_]+)$/.exec(error.message)?.[1]
        : undefined;
    throw new ReviewError(
      422,
      mapping
        ? `The ${mapping} mapping or answer is missing. Correct the survey mapping before approving this submission.`
        : "This submission cannot be mapped to a complete resource. Check its published field mappings and required answers before approving.",
    );
  }
}

const categorySlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export async function resolveApprovalCategories(
  tx: Prisma.TransactionClient,
  references: Array<{ value: string; label: string }>,
): Promise<string[]> {
  const categories = await tx.category.findMany({
    where: {
      OR: references.flatMap((reference) => [
        { id: reference.value },
        { slug: categorySlug(reference.value) },
        { name: { equals: reference.label, mode: "insensitive" as const } },
      ]),
    },
    select: { id: true, slug: true, name: true },
  });
  const ids = references.map((reference) => {
    const category =
      categories.find((category) => category.id === reference.value) ??
      categories.find(
        (category) => category.slug === categorySlug(reference.value),
      ) ??
      categories.find(
        (category) =>
          category.name.toLowerCase() === reference.label.toLowerCase(),
      );
    if (!category)
      throw new ReviewError(
        422,
        `The mapped category "${reference.label}" has no directory definition. Correct the category mapping before approval.`,
      );
    return category.id;
  });
  if (!ids.length)
    throw new ReviewError(422, "A resource needs at least one valid category.");
  return [...new Set(ids)];
}
