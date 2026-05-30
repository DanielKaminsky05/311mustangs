"use client";

import { useEffect } from "react";
import { AlertOctagon } from "lucide-react";
import { Button } from "./_components/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error.tsx]", error);
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
          Something went wrong on our side
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          The console hit an unexpected problem. Nothing you did caused this —
          try again, or come back in a minute. If it keeps happening, send the
          reference below to the engineering team.
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
        </div>
      </div>
    </div>
  );
}
