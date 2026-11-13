export function ResponseStatus({
  status,
}: {
  status: "PENDING" | "APPROVED" | "REJECTED";
}) {
  const className =
    status === "APPROVED"
      ? "bg-emerald-50 text-emerald-800"
      : status === "REJECTED"
        ? "bg-red-50 text-red-800"
        : "bg-amber-50 text-amber-800";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {status === "PENDING"
        ? "Pending"
        : status === "APPROVED"
          ? "Approved"
          : "Rejected"}
    </span>
  );
}
