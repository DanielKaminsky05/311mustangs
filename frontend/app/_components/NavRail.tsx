"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  CheckCircle2,
  CalendarClock,
  PlusCircle,
} from "lucide-react";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/submit", label: "New request", icon: PlusCircle },
  { href: "/approvals", label: "Approvals", icon: CheckCircle2 },
  { href: "/schedule", label: "Schedule", icon: CalendarClock },
] as const;

export function NavRail() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-surface"
    >
      <ul className="flex flex-col gap-0.5 p-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-civic-blue-soft text-civic-blue-deep"
                    : "text-ink-muted hover:bg-surface-alt hover:text-ink",
                ].join(" ")}
              >
                <Icon size={16} aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto p-3 text-[11px] text-ink-faint border-t border-border">
        <p className="font-mono">env: demo · v0.1</p>
        <p className="mt-1">
          Decisions on this surface are deterministic; the agent explains —
          never decides.
        </p>
      </div>
    </nav>
  );
}

export function NavRailSkeleton() {
  return (
    <div
      aria-hidden
      className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-surface"
    >
      <ul className="flex flex-col gap-0.5 p-3">
        {items.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <span className="flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium text-ink-faint">
              <Icon size={16} aria-hidden />
              <span>{label}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MobileNavBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary mobile"
      className="md:hidden sticky top-0 z-10 bg-surface border-b border-border"
    >
      <ul className="flex">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[11px]",
                  active
                    ? "text-civic-blue-deep bg-civic-blue-soft"
                    : "text-ink-muted",
                ].join(" ")}
              >
                <Icon size={16} aria-hidden />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
