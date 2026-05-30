import { Share2, Printer, Globe } from "lucide-react";

/** Toronto.ca-signature trio of outlined utility buttons that sit
 *  at the top-right of every page title row. Cosmetic but unmistakable. */
export function PageUtilityButtons() {
  const cls =
    "inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium text-ink bg-surface border border-border rounded-[3px] no-underline hover:bg-surface-alt";
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={cls} aria-label="Share">
        Share <Share2 size={14} aria-hidden />
      </button>
      <button type="button" className={cls} aria-label="Print">
        Print <Printer size={14} aria-hidden />
      </button>
      <button type="button" className={cls} aria-label="Translate">
        Translate <Globe size={14} aria-hidden />
      </button>
    </div>
  );
}
