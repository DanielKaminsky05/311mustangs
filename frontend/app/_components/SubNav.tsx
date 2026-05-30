"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  CheckCircle2,
  CalendarClock,
} from "lucide-react";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/submit", label: "New request", icon: PlusCircle },
  { href: "/approvals", label: "Approvals", icon: CheckCircle2 },
  { href: "/schedule", label: "Schedule", icon: CalendarClock },
] as const;

export function SubNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="bg-civic-blue-deep text-white"
    >
      <ul className="mx-auto w-full max-w-screen-2xl px-2 sm:px-4 flex items-stretch overflow-x-auto">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "h-11 px-4 inline-flex items-center gap-2 text-sm font-medium no-underline text-white",
                  active
                    ? "bg-civic-blue-dark border-b-2 border-civic-amber"
                    : "hover:bg-civic-blue-dark/60",
                ].join(" ")}
              >
                <Icon size={14} aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SubNavSkeleton() {
  return (
    <div aria-hidden className="bg-civic-blue-deep text-white">
      <ul className="mx-auto w-full max-w-screen-2xl px-2 sm:px-4 flex items-stretch">
        {items.map(({ href, label, icon: Icon }) => (
          <li key={href} className="shrink-0">
            <span className="h-11 px-4 inline-flex items-center gap-2 text-sm font-medium text-white/80">
              <Icon size={14} aria-hidden />
              <span>{label}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
