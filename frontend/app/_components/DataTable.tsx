import type { ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: ReactNode;
  /** Optional render — defaults to row[key as keyof T] */
  cell?: (row: T) => ReactNode;
  className?: string;
  width?: string;
  align?: "left" | "right" | "center";
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  rowHref,
  emptyMessage = "No rows.",
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  emptyMessage?: string;
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="min-w-full text-sm">
        {caption && (
          <caption className="sr-only">{caption}</caption>
        )}
        <thead>
          <tr className="border-b border-border-strong text-left text-[11px] uppercase tracking-wide text-ink-faint">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={c.width ? { width: c.width } : undefined}
                className={[
                  "px-3 py-2 font-medium",
                  c.align === "right" ? "text-right" : "",
                  c.align === "center" ? "text-center" : "",
                  c.className ?? "",
                ].join(" ")}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-8 text-center text-ink-faint text-sm"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const key = rowKey(row);
            const href = rowHref?.(row);
            return (
              <tr
                key={key}
                className={[
                  "border-b border-border last:border-b-0 even:bg-surface-alt/40",
                  href ? "hover:bg-civic-blue-soft cursor-pointer" : "",
                ].join(" ")}
              >
                {columns.map((c) => {
                  const content = c.cell
                    ? c.cell(row)
                    : (row as Record<string, ReactNode>)[c.key];
                  const inner =
                    href && c.key === columns[0].key ? (
                      <a href={href} className="text-civic-blue-deep hover:underline">
                        {content}
                      </a>
                    ) : (
                      content
                    );
                  return (
                    <td
                      key={c.key}
                      className={[
                        "px-3 py-2 align-top",
                        c.align === "right" ? "text-right" : "",
                        c.align === "center" ? "text-center" : "",
                        c.className ?? "",
                      ].join(" ")}
                    >
                      {inner}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
