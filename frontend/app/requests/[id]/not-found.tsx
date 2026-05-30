import Link from "next/link";

export default function TicketNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <h1 className="text-2xl font-medium tracking-tight">
        We couldn’t find that request
      </h1>
      <p className="text-sm text-ink-muted max-w-prose">
        The request id you opened isn’t in this console. It may have been
        closed, merged, or it may be one of the demo cases — try the dashboard
        or open the new-request form to pick one.
      </p>
      <div className="flex gap-2 mt-2">
        <Link
          href="/"
          className="text-sm text-civic-blue-deep underline underline-offset-4"
        >
          Dashboard
        </Link>
        <Link
          href="/submit"
          className="text-sm text-civic-blue-deep underline underline-offset-4"
        >
          New request
        </Link>
      </div>
    </div>
  );
}
