import Link from "next/link";

export default function TicketNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Ticket not found</h1>
      <p className="text-sm text-ink-muted max-w-prose">
        That ticket isn&apos;t in the fixture set. Try one of the demo cases
        on the new-request form.
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
