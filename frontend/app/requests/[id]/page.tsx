import { notFound } from "next/navigation";
import {
  getAttachmentsForRequest,
  getAuditEntries,
  getCanonicalTickets,
  getCopilotScripts,
  getEvidencePack,
  getTicket,
} from "../../_server/data";
import { Panel } from "../../_components/Panel";
import { DefinitionList } from "../../_components/DefinitionList";
import { DecisionChip, HardRouteBadge } from "../../_components/DecisionChip";
import { ConfidenceList } from "../../_components/ConfidenceList";
import { ScoreBar } from "../../_components/ScoreBar";
import { ScoreBreakdown } from "../../_components/ScoreBreakdown";
import { EvidenceCard } from "../../_components/EvidenceCard";
import {
  HazardFlagGridReadonly,
} from "../../_components/HazardFlagGrid";
import { AttachmentTile } from "../../_components/AttachmentTile";
import { EmptyState } from "../../_components/EmptyState";
import { CopilotChatPanel } from "./CopilotChatPanel";

export async function generateStaticParams() {
  const tickets = await getCanonicalTickets();
  return tickets.map((t) => ({ id: t.ticket_id }));
}

export default async function TriagePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [ticket, evidence] = await Promise.all([
    getTicket(id),
    getEvidencePack(id),
  ]);
  if (!ticket || !evidence) notFound();

  const [audits, attachments, scripts] = await Promise.all([
    getAuditEntries(evidence.audit_refs),
    getAttachmentsForRequest(id),
    getCopilotScripts(),
  ]);
  const availableTopics = Object.keys(scripts[id] ?? {});

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-6">
      <div className="flex flex-col gap-6 min-w-0">
        <header className="flex flex-col gap-3">
          <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Request{" "}
              <span className="font-mono text-civic-blue-deep">
                {ticket.ticket_id}
              </span>
            </h1>
            <span className="text-xs text-ink-muted font-mono">
              reported_at {ticket.reported_at} · source {ticket.source}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DecisionChip signal="category" value={evidence.category_decision} />
            <DecisionChip
              signal="duplicate"
              value={evidence.duplicate_decision}
            />
            <DecisionChip signal="urgency" value={evidence.urgency_decision} />
            <DecisionChip signal="route" value={evidence.route} />
            <HardRouteBadge flags={evidence.hard_route_flags} />
          </div>
        </header>

        <Panel title="Submitted ticket">
          <div className="flex flex-col gap-4">
            <DefinitionList
              items={[
                { label: "description", value: ticket.description },
                {
                  label: "location",
                  value: (
                    <>
                      <p>{ticket.location.raw_text}</p>
                      <p className="text-xs text-ink-muted font-mono">
                        {ticket.location.intersection_street_1 ?? "—"} /{" "}
                        {ticket.location.intersection_street_2 ?? "—"} · FSA{" "}
                        {ticket.location.postal_code_or_fsa ?? "—"}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {ticket.location.ward ?? "—"}
                      </p>
                    </>
                  ),
                },
                {
                  label: "observed_at",
                  value: ticket.observed_at,
                  mono: true,
                },
              ]}
            />
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint mb-2">
                hazard_flags
              </p>
              <HazardFlagGridReadonly
                flags={ticket.hazard_flags}
                fired={evidence.hard_route_flags}
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint mb-2">
                attachments
              </p>
              {attachments.length === 0 ? (
                <p className="text-sm text-ink-muted">No attachments.</p>
              ) : (
                <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {attachments.map((a) => (
                    <li key={a.attachment_id}>
                      <AttachmentTile
                        attachment_id={a.attachment_id}
                        display_name={a.display_name}
                        mime_type={a.mime_type}
                        size_bytes={a.size_bytes}
                        preview_url={`/uploads/${a.storage_scope}/${a.attachment_id}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>

        <Panel
          title="Category candidates"
          subtitle="DGX vector search against the 311 category taxonomy."
        >
          <ConfidenceList
            candidates={evidence.category_candidates}
            confidence={evidence.category_confidence}
            margin={evidence.category_margin}
          />
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
              structured_text used as the query embedding
            </summary>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-ink bg-surface-alt p-2 border border-border rounded-sm">
              {evidence.structured_text}
            </pre>
          </details>
        </Panel>

        <Panel title="Urgency score">
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-baseline justify-between text-sm mb-2">
                <span className="font-mono text-ink-muted">urgency_score</span>
                <span className="font-mono text-xl text-ink tabular-nums">
                  {evidence.urgency_score.toFixed(2)}
                </span>
              </div>
              <ScoreBar
                value={evidence.urgency_score}
                ticks={[0.45, 0.75]}
                variant="urgency"
              />
              <p className="mt-2 text-[11px] text-ink-faint font-mono">
                thresholds: ≥ 0.45 review · ≥ 0.75 human review
              </p>
            </div>
            <ScoreBreakdown
              breakdown={evidence.score_breakdown}
              total={evidence.urgency_score}
            />
          </div>
        </Panel>

        <Panel
          title="Nearest historical records"
          subtitle="Evidence — completed 311 records most similar to this ticket."
        >
          {evidence.nearest_historical_records.length === 0 ? (
            <EmptyState title="No historical matches above threshold." />
          ) : (
            <ul className="flex flex-col gap-2">
              {evidence.nearest_historical_records.map((r) => (
                <li key={r.record_id}>
                  <EvidenceCard record={r} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Active duplicate candidates"
          subtitle={
            evidence.duplicate_decision === "NOT_DUPLICATE"
              ? "No active duplicates after metadata filtering."
              : "Active matches after metadata filtering."
          }
        >
          {evidence.active_duplicate_candidates.length === 0 ? (
            <EmptyState
              title="NOT_DUPLICATE"
              hint={
                <>
                  duplicate_score{" "}
                  <span className="font-mono">
                    {evidence.duplicate_score.toFixed(2)}
                  </span>{" "}
                  · below threshold.
                </>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {evidence.active_duplicate_candidates.map((r) => (
                <li key={r.record_id}>
                  <EvidenceCard record={r} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Audit trail">
          <ol className="flex flex-col gap-2">
            {audits.map((a) => (
              <li
                key={a.audit_id}
                id={a.audit_id}
                className="border border-border rounded-sm bg-surface-alt/30 px-3 py-2 target:bg-civic-blue-soft target:border-civic-blue"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-mono text-ink-muted">
                    {a.audit_id} · {a.stage}
                  </p>
                  <p className="text-[11px] font-mono text-ink-faint">
                    {a.timestamp}
                  </p>
                </div>
                <p className="text-sm text-ink mt-1">{a.summary}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <CopilotChatPanel
        ticket_id={id}
        availableTopics={availableTopics}
      />
    </div>
  );
}
