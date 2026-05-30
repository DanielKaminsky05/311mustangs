import type { ReactNode } from "react";

/** Toronto.ca-style section panel: borderless title with a brand-blue
 *  hairline underneath, thin grey body border, no heavy chrome. */
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
        "bg-surface border border-border rounded-[3px]",
        className ?? "",
      ].join(" ")}
    >
      {(title || actions) && (
        <header className="flex items-end justify-between gap-3 px-5 pt-4 pb-3 border-b border-border">
          <div>
            {title && (
              <h2 className="text-lg leading-tight font-medium text-ink tracking-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-sm text-ink-muted mt-1">{subtitle}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 pb-0.5">{actions}</div>
          )}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  intro,
  crumbs,
  actions,
  hero,
}: {
  title: ReactNode;
  intro?: ReactNode;
  crumbs?: ReactNode;
  actions?: ReactNode;
  hero?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {crumbs}
      <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-border">
        <h1 className="text-3xl sm:text-[36px] leading-[1.15] font-medium text-ink tracking-tight m-0">
          {title}
        </h1>
        {actions && (
          <div className="shrink-0 mt-2 sm:mt-1">{actions}</div>
        )}
      </div>
      {hero && <div className="mt-4">{hero}</div>}
      {intro && (
        <p className="mt-4 text-base text-ink max-w-prose">{intro}</p>
      )}
    </header>
  );
}
