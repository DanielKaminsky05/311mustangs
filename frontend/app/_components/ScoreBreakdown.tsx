export function ScoreBreakdown({
  breakdown,
  total,
}: {
  breakdown: {
    category_base_score: number;
    hazard_boost_total: number;
    keyword_boost_total: number;
    penalty_total: number;
    hard_routes_triggered?: string[];
  };
  total: number;
}) {
  const items: Array<{ label: string; value: number; sign: "+" | "-" }> = [
    {
      label: "Category base score",
      value: breakdown.category_base_score,
      sign: "+",
    },
    {
      label: "Boost from safety hazards reported",
      value: breakdown.hazard_boost_total,
      sign: "+",
    },
    {
      label: "Boost from urgency keywords in the description",
      value: breakdown.keyword_boost_total,
      sign: "+",
    },
    {
      label: "Penalties",
      value: breakdown.penalty_total,
      sign: "-",
    },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {items.map(({ label, value, sign }) => (
        <div
          key={label}
          className="flex items-center justify-between gap-3 text-sm border-b border-border pb-1.5 last:border-b-0"
        >
          <span className="text-ink-muted">{label}</span>
          <span className="font-mono text-ink tabular-nums">
            {sign === "-" ? "−" : "+"}
            {value.toFixed(2)}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 text-sm pt-2 mt-1 border-t-2 border-border-strong">
        <span className="text-ink font-semibold">Final urgency score</span>
        <span className="font-mono text-ink font-semibold tabular-nums">
          {total.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
