import type {
  SurveySnapshot,
  SurveyAnswers,
} from "@/modules/surveys/survey-snapshot";
import { displaySurveyAnswer } from "@/modules/surveys/answer-display";
import { ResponseImage } from "./response-image";

export function ResponseAnswers({
  id,
  snapshot,
  answers,
  hasImage,
  imagesAvailable,
}: {
  id: string;
  snapshot: SurveySnapshot;
  answers: SurveyAnswers;
  hasImage: boolean;
  imagesAvailable: boolean;
}) {
  return (
    <div className="space-y-5">
      {snapshot.sections.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`review-${section.id}`}
          className="min-w-0 rounded-xl border bg-background p-4 sm:p-6"
        >
          <h2
            id={`review-${section.id}`}
            className="mb-5 border-b pb-3 text-lg font-semibold"
          >
            {section.title}
          </h2>
          <dl className="space-y-5">
            {section.fields.map((field) => (
              <div key={field.id} data-answer-key={field.fieldKey}>
                <dt className="text-sm font-medium">
                  {field.order}. {field.label}
                </dt>
                <dd className="mt-2 whitespace-pre-wrap text-sm leading-7 break-words text-muted-foreground">
                  {field.fieldType === "IMAGE_UPLOAD" ? (
                    <ResponseImage
                      id={id}
                      hasImage={hasImage}
                      available={imagesAvailable}
                    />
                  ) : (
                    displaySurveyAnswer(
                      field,
                      answers[field.fieldKey],
                      hasImage,
                    )
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
