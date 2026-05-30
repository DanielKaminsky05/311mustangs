import type { ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell?: (row: T) => ReactNode;
  className?: string;
  width?: string;
  align?: "left" | "right" | "center";
};

/** Toronto.ca-style table: 1px #DDDDDD borders on rows, zebra #F8F8F8,
 *  dense padding (th 8/16, td 6/16), medium-weight headers. */
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
    <div className="overflow-x-auto -mx-5 sm:mx-0">
      <table className="min-w-full text-[15px] border-collapse">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-border text-left text-sm text-civic-blue">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={c.width ? { width: c.width } : undefined}
                className={[
                  "px-4 py-2 font-medium border-b border-border",
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
                className="px-4 py-8 text-center text-ink-muted text-sm"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map((row, i) => {
            const key = rowKey(row);
            const href = rowHref?.(row);
            const zebra = i % 2 === 1;
            return (
              <tr
                key={key}
                className={[
                  "border-b border-border last:border-b-0",
                  zebra ? "bg-surface-alt" : "bg-surface",
                  href ? "hover:bg-civic-blue-soft cursor-pointer" : "",
                ].join(" ")}
              >
                {columns.map((c) => {
                  const content = c.cell
                    ? c.cell(row)
                    : (row as Record<string, ReactNode>)[c.key];
                  const inner =
                    href && c.key === columns[0].key ? (
                      <a href={href} className="text-civic-blue hover:text-civic-blue-deep">
                        {content}
                      </a>
                    ) : (
                      content
                    );
                  return (
                    <td
                      key={c.key}
                      className={[
                        "px-4 py-1.5 align-top text-ink",
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
