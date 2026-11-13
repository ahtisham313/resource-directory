export function SectionPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="max-w-3xl rounded-2xl border bg-background p-5 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        {description}
      </p>
    </section>
  );
}
