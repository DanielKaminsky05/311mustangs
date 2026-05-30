import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={[
        "bg-surface border border-border rounded-sm",
        className ?? "",
      ].join(" ")}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border bg-surface-alt/60">
          <div>
            {title && (
              <h2 className="text-sm font-semibold tracking-tight text-ink">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
