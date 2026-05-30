export function ScoreBar({
  value,
  max = 1,
  ticks = [],
  variant = "urgency",
  label,
}: {
  value: number;
  max?: number;
  ticks?: number[];
  variant?: "urgency" | "duplicate" | "neutral";
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const color =
    variant === "urgency"
      ? value >= 0.75
        ? "var(--color-decision-stop)"
        : value >= 0.45
          ? "var(--color-decision-warn)"
          : "var(--color-decision-ok)"
      : variant === "duplicate"
        ? value >= 0.8
          ? "var(--color-decision-stop)"
          : value >= 0.6
            ? "var(--color-decision-warn)"
            : "var(--color-decision-neutral)"
        : "var(--color-civic-blue)";

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
          <span>{label}</span>
          <span className="font-mono text-ink">{value.toFixed(2)}</span>
        </div>
      )}
      <div
        className="relative h-2 w-full bg-surface-alt rounded-sm border border-border overflow-hidden"
        role="img"
        aria-label={`${label ?? "score"} ${value.toFixed(2)} of ${max}`}
      >
        <div
          className="absolute top-0 left-0 h-full"
          style={{ width: `${pct * 100}%`, background: color }}
        />
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute top-0 h-full w-px bg-ink-faint/60"
            style={{ left: `${(t / max) * 100}%` }}
            aria-hidden
          />
        ))}
      </div>
      {ticks.length > 0 && (
        <div className="relative h-3 mt-1">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2 text-[10px] font-mono text-ink-faint"
              style={{ left: `${(t / max) * 100}%` }}
            >
              {t.toFixed(2)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
