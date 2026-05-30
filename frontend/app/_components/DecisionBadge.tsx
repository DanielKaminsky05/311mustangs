import { DECISION_META, type DecisionLabel } from "@/app/lib/mock-data";
import { BADGE, type Tone } from "@/app/lib/tone";

export function DecisionBadge({
  label,
  size = "md",
}: {
  label: DecisionLabel;
  size?: "sm" | "md";
}) {
  const meta = DECISION_META[label];
  const pad = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${pad} ${BADGE[meta.tone as Tone]}`}
    >
      <span className="inline-block size-1.5 rounded-full bg-current opacity-70" />
      {meta.label}
    </span>
  );
}
