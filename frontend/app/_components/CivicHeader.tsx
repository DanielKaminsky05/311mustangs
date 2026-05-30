import type { ReactNode } from "react";
import Link from "next/link";
import { Phone } from "lucide-react";

/** Toronto.ca-style brand bar: skyline glyph + TORONTO wordmark, centered
 *  search/utility, amber CTA on the right. Reproduces the live header
 *  proportions (~84px row + ~44px sub-nav). */
export function CivicHeader({ rightSlot }: { rightSlot?: ReactNode } = {}) {
  return (
    <header className="shrink-0">
      <div className="bg-civic-blue text-white">
        <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 h-[84px] flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-3 text-white hover:text-white"
          >
            <SkylineGlyph />
            <span className="font-brand text-[34px] leading-none">
              TORONTO
            </span>
          </Link>

          <div className="hidden md:flex flex-1 items-center justify-center gap-2">
            <div className="flex items-center w-full max-w-md">
              <div className="flex-1 h-9 px-3 bg-white text-ink rounded-l-[3px] text-sm flex items-center justify-between border border-white">
                <span className="text-ink-faint">Search</span>
                <span className="text-ink-faint text-xs font-mono">⌘K</span>
              </div>
              <button
                type="button"
                className="h-9 px-3 bg-civic-blue-deep text-white text-sm rounded-r-[3px] border border-white border-l-0 hover:bg-civic-blue-dark"
                aria-label="Search"
              >
                Search
              </button>
            </div>
            <div className="hidden lg:flex items-center gap-px ml-1">
              <button
                type="button"
                className="h-9 w-9 grid place-items-center bg-civic-blue-deep text-white text-xs font-medium border border-white/40 hover:bg-civic-blue-dark"
                aria-label="Increase text size"
              >
                A+
              </button>
              <button
                type="button"
                className="h-9 w-9 grid place-items-center bg-civic-blue-deep text-white text-xs font-medium border border-white/40 hover:bg-civic-blue-dark"
                aria-label="Decrease text size"
              >
                A-
              </button>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {rightSlot}
            <Link
              href="/submit"
              className="hidden sm:inline-flex items-center gap-2 h-9 px-3 bg-civic-amber text-black text-sm font-medium rounded-[3px] no-underline hover:bg-civic-amber-hover hover:text-black"
            >
              I want to…
              <span aria-hidden>▾</span>
            </Link>
            <a
              href="tel:311"
              className="hidden md:inline-flex items-center gap-1.5 text-sm font-medium text-white no-underline hover:underline"
            >
              <Phone size={14} aria-hidden />
              Contact 311
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

function SkylineGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 44 36"
      width="40"
      height="34"
      className="text-white"
    >
      {/* Stylized CN tower + building cluster, in the Toronto.ca vein */}
      <g fill="currentColor">
        <rect x="3" y="20" width="6" height="14" />
        <rect x="11" y="14" width="5" height="20" />
        <rect x="18" y="10" width="4" height="24" />
        {/* CN tower silhouette */}
        <rect x="24" y="4" width="2" height="30" />
        <polygon points="22,12 28,12 25,8" />
        <rect x="23" y="14" width="4" height="2" />
        <rect x="29" y="16" width="6" height="18" />
        <rect x="37" y="22" width="4" height="12" />
      </g>
    </svg>
  );
}
