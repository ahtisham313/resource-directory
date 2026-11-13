export default function ResponseNotFound() {
  return (
    <div className="rounded-xl border bg-background p-6">
      <h1 className="text-xl font-semibold">Response not found</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        This submission is no longer available.
      </p>
    </div>
  );
}
