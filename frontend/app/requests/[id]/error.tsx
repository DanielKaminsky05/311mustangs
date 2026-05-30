"use client";

import { useEffect } from "react";
import { AlertOctagon } from "lucide-react";
import Link from "next/link";
import { Button } from "../../_components/Button";

export default function TicketError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[requests/[id]/error.tsx]", error);
  }, [error]);

  return (
    <div className="py-16 px-4">
      <div className="mx-auto max-w-prose text-center">
        <AlertOctagon
          size={28}
          aria-hidden
          className="mx-auto text-[color:var(--color-decision-stop)]"
        />
        <h1 className="mt-3 text-2xl font-medium text-ink">
          We couldn&apos;t load this request
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          The triage details didn&apos;t come through. The request itself is
          fine — try refreshing, or head back to the dashboard.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs font-mono text-ink-faint">
            ref: {error.digest}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="primary" onClick={() => reset()}>
            Try again
          </Button>
          <Link
            href="/"
            className="text-sm text-civic-blue hover:text-civic-blue-deep underline underline-offset-4"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
