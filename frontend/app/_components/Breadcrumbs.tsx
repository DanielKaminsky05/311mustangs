import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="bg-surface-alt border-b border-border"
    >
      <ol className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 py-2 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
        <li className="flex items-center gap-1">
          <Home size={12} aria-hidden />
          <Link href="/" className="no-underline hover:underline">
            Operator console
          </Link>
        </li>
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            <ChevronRight size={12} className="text-ink-faint" aria-hidden />
            {c.href ? (
              <Link href={c.href} className="no-underline hover:underline">
                {c.label}
              </Link>
            ) : (
              <span className="text-ink">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
