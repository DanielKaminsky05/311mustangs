export function ScoreBreakdown({
  breakdown,
  total,
}: {
  breakdown: {
    category_base_score: number;
    hazard_boost_total: number;
    keyword_boost_total: number;
    penalty_total: number;
  };
  total: number;
}) {
  const rows: Array<{ label: string; value: number; sign: "+" | "-" | "=" }> = [
    { label: "category_base_score", value: breakdown.category_base_score, sign: "=" },
    { label: "hazard_boost_total", value: breakdown.hazard_boost_total, sign: "+" },
    { label: "keyword_boost_total", value: breakdown.keyword_boost_total, sign: "+" },
    { label: "penalty_total", value: breakdown.penalty_total, sign: "-" },
  ];

  return (
    <table className="w-full text-sm font-mono">
      <tbody>
        {rows.map(({ label, value, sign }) => (
          <tr key={label} className="border-b border-border last:border-b-0">
            <td className="py-1.5 pr-2 text-ink-faint w-6">{sign}</td>
            <td className="py-1.5 pr-2 text-ink-muted">{label}</td>
            <td className="py-1.5 pl-2 text-right text-ink tabular-nums">
              {value.toFixed(2)}
            </td>
          </tr>
        ))}
        <tr className="border-t-2 border-border-strong">
          <td className="py-1.5 pr-2 text-ink-faint w-6">=</td>
          <td className="py-1.5 pr-2 text-ink font-semibold">urgency_score</td>
          <td className="py-1.5 pl-2 text-right text-ink font-semibold tabular-nums">
            {total.toFixed(2)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
