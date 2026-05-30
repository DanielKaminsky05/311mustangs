import type { ReactNode } from "react";

export function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center text-ink-muted">
      {icon && <div className="mb-2 text-ink-faint">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 text-xs max-w-prose">{hint}</p>}
    </div>
  );
}
