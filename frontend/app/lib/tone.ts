/**
 * Static Tailwind class maps keyed by a semantic "tone".
 *
 * Tailwind v4 only emits classes it can see as complete literal strings, so we
 * cannot build class names dynamically (e.g. `bg-${tone}-500`). Keep full
 * literals here and look them up by key.
 */

export type Tone = "amber" | "emerald" | "sky" | "rose" | "violet" | "zinc";

export const BADGE: Record<Tone, string> = {
  amber:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  emerald:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  sky: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
  rose: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  violet:
    "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900",
  zinc: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
};

/** Bar fill colour for score meters, keyed by a 0–1 value's risk band. */
export function scoreBarClass(value: number): string {
  if (value >= 0.75) return "bg-emerald-500";
  if (value >= 0.45) return "bg-amber-500";
  return "bg-zinc-400 dark:bg-zinc-600";
}
