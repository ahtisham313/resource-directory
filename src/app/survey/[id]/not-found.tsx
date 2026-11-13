export default function SurveyNotFound() {
  return (
    <section className="rounded-2xl border bg-background p-5 sm:p-8">
      <h1 className="text-2xl font-semibold">Survey not available</h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        This survey may have closed, or the link may be incorrect.
      </p>
    </section>
  );
}
