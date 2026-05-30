"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/submit", label: "Submit request", icon: "＋" },
  { href: "/approvals", label: "Approvals", icon: "✓" },
  { href: "/copilot", label: "Copilot", icon: "✦" },
];

export function Sidebar({ approvalCount }: { approvalCount: number }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2 px-5 py-4">
        <span className="grid size-7 place-items-center rounded-md bg-zinc-900 text-sm font-bold text-white dark:bg-white dark:text-zinc-900">
          3
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">311mustangs</div>
          <div className="text-xs text-zinc-400">Resolution engine</div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-2 py-2">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <span className="w-4 text-center text-zinc-400">{item.icon}</span>
              {item.label}
              {item.href === "/approvals" && approvalCount > 0 && (
                <span className="ml-auto rounded-full bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                  {approvalCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-5 py-4 text-xs text-zinc-400">
        Demo clock
        <div className="font-mono text-zinc-500 dark:text-zinc-400">
          2026-01-15 20:00
        </div>
      </div>
    </aside>
  );
}
