import type { ReactNode } from "react";

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border bg-surface-alt/60">
      {children}
    </div>
  );
}
