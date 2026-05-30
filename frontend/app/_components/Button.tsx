import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "amber" | "secondary" | "ghost" | "danger";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-civic-blue text-white hover:bg-civic-blue-deep border border-civic-blue",
  amber:
    "bg-civic-amber text-black hover:bg-civic-amber-hover border border-civic-amber",
  secondary:
    "bg-surface text-civic-blue hover:bg-civic-blue-soft border border-border",
  ghost:
    "bg-transparent text-civic-blue hover:bg-civic-blue-soft border border-transparent",
  danger:
    "bg-[color:var(--color-decision-stop)] text-white hover:bg-[color:var(--color-decision-stop)]/90 border border-[color:var(--color-decision-stop)]",
};

export function Button({
  variant = "secondary",
  size = "md",
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md";
}) {
  return (
    <button
      {...rest}
      className={[
        "inline-flex items-center justify-center gap-2 font-medium rounded-[3px] no-underline transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3 text-sm",
        VARIANT[variant],
        className ?? "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "secondary",
  size = "md",
  href,
  children,
  className,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  size?: "sm" | "md";
  href: string;
}) {
  const cls = [
    "inline-flex items-center justify-center gap-2 font-medium rounded-[3px] no-underline transition-colors",
    size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3 text-sm",
    VARIANT[variant],
    className ?? "",
  ].join(" ");
  // Internal routes use next/link for client navigation + prefetching;
  // external URLs fall through to a plain anchor.
  const isInternal = href.startsWith("/") && !href.startsWith("//");
  if (isInternal) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} {...rest} className={cls}>
      {children}
    </a>
  );
}
