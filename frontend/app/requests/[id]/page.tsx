import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DECISION_META,
  formatBytes,
  formatTime,
  getRequest,
} from "@/app/lib/mock-data";
import { DecisionBadge } from "@/app/_components/DecisionBadge";
import { ScoreBreakdown } from "@/app/_components/ScoreBreakdown";
import { EvidenceList } from "@/app/_components/EvidenceList";
import { ScheduleView } from "@/app/_components/ScheduleView";

export default async function RequestDetailPage({
  params,
}: PageProps<"/requests/[id]">) {
  const { id } = await params;
  const request = getRequest(id);
  if (!request) notFound();

  const { decision } = request;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        ← Dashboard
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <DecisionBadge label={decision.label} />
          <span className="font-mono text-xs text-zinc-400">{request.id}</span>
          <span className="text-xs text-zinc-400">
            {request.channel} · {formatTime(request.submitted_at)}
          </span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          {request.description}
        </h1>
        <p className="text-sm text-zinc-500">
          {request.service_request_type} · {request.location} · {request.ward}
        </p>
      </header>

      <Card title="Decision">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {decision.summary || DECISION_META[decision.label].blurb}
        </p>
      </Card>

      <Card title="Deterministic scores">
        <ScoreBreakdown scores={decision.scores} />
      </Card>

      {decision.schedule && (
        <Card title="Schedule insertion">
          <ScheduleView candidates={decision.schedule} />
        </Card>
      )}

      {request.attachments.length > 0 && (
        <Card title="Attachments">
          <ul className="grid gap-2 sm:grid-cols-2">
            {request.attachments.map((a) => (
              <li
                key={a.attachment_id}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-zinc-100 text-xs font-medium text-zinc-500 dark:bg-zinc-800">
                  {a.mime_type.startsWith("image/") ? "IMG" : "PDF"}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm text-zinc-700 dark:text-zinc-200">
                    {a.display_name}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {formatBytes(a.size_bytes)}
                    {a.vision_caption && (
                      <>
                        {" · "}
                        <span className="italic">“{a.vision_caption}”</span>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-400">
            Image captions are produced by the optional DGX vision-grounding path
            and only inform the deterministic category — they never override
            scores.
          </p>
        </Card>
      )}

      <Card title="Evidence">
        <EvidenceList
          records={decision.nearest}
          structuredText={decision.structured_text}
          auditLogId={decision.audit_log_id}
        />
      </Card>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
