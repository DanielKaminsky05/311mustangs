import type { ReactNode } from "react";

export type DLItem = { label: string; value: ReactNode; mono?: boolean };

export function DefinitionList({ items }: { items: DLItem[] }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map(({ label, value, mono }) => (
        <div key={label} className="contents">
          <dt className="text-xs uppercase tracking-wide text-ink-faint pt-0.5">
            {label}
          </dt>
          <dd
            className={[
              "text-ink",
              mono ? "font-mono text-[13px]" : "",
            ].join(" ")}
          >
            {value ?? <span className="text-ink-faint">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
