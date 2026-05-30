/**
 * Locale-aware formatters. en-CA matches the City of Toronto frontend.
 *
 * These all operate on stable inputs (an ISO timestamp, a 0-1 score, a byte
 * count) and produce strings — safe in Server Components and free of any
 * server/client rendering mismatch.
 */

const LOCALE = "en-CA";

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateOnlyFormatter = new Intl.DateTimeFormat(LOCALE, {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const percentFormatter = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat(LOCALE);

const sizeFormatter1 = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 1,
});

const pluralRules = new Intl.PluralRules(LOCALE);

/** Format an ISO timestamp like "2026-01-15T20:03:00" as "Jan 15, 2026, 20:03". */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return dateTimeFormatter.format(d);
}

/** Format an ISO timestamp as a date only — "Jan 15, 2026". */
export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return dateOnlyFormatter.format(d);
}

/** Format a 0-1 score as "62%". */
export function formatPercent(value: number): string {
  return percentFormatter.format(value);
}

/** Format an integer count like "190,432". */
export function formatCount(value: number): string {
  return integerFormatter.format(value);
}

/** Plural-aware count helper: `pluralize(3, "item")` → "items". */
export function pluralize(n: number, singular: string, plural?: string): string {
  return pluralRules.select(n) === "one" ? singular : (plural ?? `${singular}s`);
}

/** Format a byte count like 195000 → "195 KB". */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024)
    return `${integerFormatter.format(Math.round(bytes / 1024))} KB`;
  return `${sizeFormatter1.format(bytes / (1024 * 1024))} MB`;
}

/** Current-time helper for the submit form's "observed_at" default. */
export function nowForDatetimeLocalInput(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
