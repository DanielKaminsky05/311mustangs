import type { ReactNode } from "react";

/** Toronto.ca-signature "In This Section" sidebar: brand-blue title bar
 *  over a vertical linked list. Used for in-page navigation on long pages. */
export function SectionSidebar({
  title = "On this page",
  items,
}: {
  title?: string;
  items: { label: ReactNode; href: string; active?: boolean }[];
}) {
  return (
    <nav
      aria-label={title}
      className="border border-border bg-surface rounded-[3px] overflow-hidden"
    >
      <header className="bg-civic-blue text-white px-3 py-2 font-medium text-sm">
        {title}
      </header>
      <ul className="flex flex-col">
        {items.map((it, i) => (
          <li
            key={i}
            className="border-b border-border last:border-b-0"
          >
            <a
              href={it.href}
              aria-current={it.active ? "true" : undefined}
              className={[
                "block px-3 py-2 text-sm no-underline",
                it.active
                  ? "bg-civic-blue-soft text-civic-blue-deep font-medium"
                  : "text-civic-blue hover:bg-surface-alt",
              ].join(" ")}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
