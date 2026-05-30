import Link from "next/link";

export function CivicHeader() {
  return (
    <header className="h-14 shrink-0 bg-civic-blue-deep text-white border-b border-civic-blue-deep">
      <div className="mx-auto w-full max-w-screen-2xl h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 group">
          <div
            aria-hidden
            className="h-7 w-7 rounded-sm bg-white text-civic-blue-deep grid place-items-center font-mono text-sm font-semibold"
          >
            311
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/70">
              City of Toronto
            </span>
            <span className="text-sm font-semibold tracking-tight group-hover:underline underline-offset-4">
              311 Mustangs · Operator Console
            </span>
          </div>
        </Link>
        <div className="hidden sm:flex items-center gap-3 text-xs">
          <span className="rounded-sm bg-white/10 px-2 py-0.5 font-mono">
            DEMO · CLOCK 2026-01-15 20:00
          </span>
          <span className="rounded-sm border border-white/25 px-2 py-0.5">
            Operator: J. Lin
          </span>
        </div>
      </div>
    </header>
  );
}
