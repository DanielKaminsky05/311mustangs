import { notFound } from "next/navigation";
import {
  getAttachmentsForRequest,
  getAuditEntries,
  getCanonicalTickets,
  getCopilotScripts,
  getEvidencePack,
  getTicket,
} from "../../_server/data";
import { Panel, PageHeader } from "../../_components/Panel";
import { PageUtilityButtons } from "../../_components/PageUtilityButtons";
import { Breadcrumbs } from "../../_components/Breadcrumbs";
import { SectionSidebar } from "../../_components/SectionSidebar";
import {
  categoryLabels,
  describeStrength,
  duplicateLabels,
  hardRouteLabels,
  routeLabels,
  urgencyLabels,
} from "../../_lib/translations";
import { formatPercent, formatTimestamp } from "../../_lib/format";
import { DefinitionList } from "../../_components/DefinitionList";
import { DecisionChip, HardRouteBadge } from "../../_components/DecisionChip";
import { ConfidenceList } from "../../_components/ConfidenceList";
import { ScoreBar } from "../../_components/ScoreBar";
import { ScoreBreakdown } from "../../_components/ScoreBreakdown";
import { EvidenceCard } from "../../_components/EvidenceCard";
import { SafetyAnswersReadout } from "../../_components/HazardFlagGrid";
import { AttachmentTile } from "../../_components/AttachmentTile";
import { EmptyState } from "../../_components/EmptyState";
import { CopilotChatPanel } from "./CopilotChatPanel";

const STAGE_LABEL: Record<string, string> = {
  validation: "Checked the request",
  structured_text: "Built the text to search",
  category_inference: "Picked the best category",
  historical_similarity: "Found past similar requests",
  duplicate_retrieval: "Looked for open duplicates",
  urgency_scoring: "Scored the urgency",
  routing: "Decided where to send it",
};

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

  const sidebarItems = [
    { label: "What the citizen said", href: "#submitted" },
    { label: "Best matching categories", href: "#category" },
    { label: "How urgent is it?", href: "#urgency" },
    { label: "Past similar requests", href: "#historical" },
    { label: "Open requests that look like this", href: "#duplicates" },
    { label: "What the system did, step by step", href: "#audit" },
  ];

  return (
    <>
      <PageHeader
        crumbs={
          <Breadcrumbs
            items={[
              { label: "Requests", href: "/" },
              { label: ticket.ticket_id },
            ]}
          />
        }
        actions={<PageUtilityButtons />}
        title={
          <>
            Request{" "}
            <span className="font-mono text-civic-blue-deep">
              {ticket.ticket_id}
            </span>
          </>
        }
        intro={
          <span className="text-sm text-ink-muted">
            Reported{" "}
            <span className="tabular-nums" title={ticket.reported_at}>
              {formatTimestamp(ticket.reported_at)}
            </span>{" "}
            via <span className="font-medium">{ticket.source}</span>
          </span>
        }
      />
      <div className="flex flex-wrap items-center gap-2 -mt-2 mb-6">
        <DecisionChip signal="category" value={evidence.category_decision} />
        <DecisionChip signal="duplicate" value={evidence.duplicate_decision} />
        <DecisionChip signal="urgency" value={evidence.urgency_decision} />
        <DecisionChip signal="route" value={evidence.route} />
        <HardRouteBadge flags={evidence.score_breakdown.hard_routes_triggered} />
      </div>

    <div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-6">
      <div className="flex flex-col gap-6 min-w-0">
        <Panel title="What we found">
          <dl className="grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="text-xs uppercase tracking-wide text-ink-faint pt-0.5">
              Category
            </dt>
            <dd className="text-ink">
              <p>
                <span className="font-medium">
                  {evidence.category_candidates[0]?.service_request_type ??
                    "Unknown"}
                </span>{" "}
                <span className="text-ink-muted">
                  ({evidence.category_candidates[0]?.division})
                </span>
              </p>
              <p className="text-xs text-ink-muted">
                {categoryLabels[evidence.category_decision].hint}
              </p>
            </dd>

            <dt className="text-xs uppercase tracking-wide text-ink-faint pt-0.5">
              Duplicate
            </dt>
            <dd className="text-ink">
              <p className="font-medium">
                {duplicateLabels[evidence.duplicate_decision].label}
              </p>
              {duplicateLabels[evidence.duplicate_decision].hint && (
                <p className="text-xs text-ink-muted">
                  {duplicateLabels[evidence.duplicate_decision].hint}
                </p>
              )}
            </dd>

            <dt className="text-xs uppercase tracking-wide text-ink-faint pt-0.5">
              Urgency
            </dt>
            <dd className="text-ink">
              <p className="font-medium">
                {urgencyLabels[evidence.urgency_decision].label}
              </p>
              <p className="text-xs text-ink-muted">
                {urgencyLabels[evidence.urgency_decision].hint}
              </p>
              {evidence.score_breakdown.hard_routes_triggered.length > 0 && (
                <p className="text-xs text-[color:var(--color-decision-stop)] mt-1">
                  Hard-route reasons:{" "}
                  {evidence.score_breakdown.hard_routes_triggered
                    .map(
                      (k) =>
                        hardRouteLabels[k as keyof typeof hardRouteLabels],
                    )
                    .join(", ")}
                </p>
              )}
            </dd>

            <dt className="text-xs uppercase tracking-wide text-ink-faint pt-0.5">
              Next step
            </dt>
            <dd className="text-ink">
              <p className="font-medium">{routeLabels[evidence.route].label}</p>
              <p className="text-xs text-ink-muted">
                {routeLabels[evidence.route].hint}
              </p>
            </dd>
          </dl>
        </Panel>

        <Panel
          id="submitted"
          title="What the citizen said"
          className="scroll-mt-24"
        >
          <div className="flex flex-col gap-4">
            <DefinitionList
              items={[
                { label: "The issue", value: ticket.description },
                {
                  label: "Where",
                  value: (
                    <>
                      <p>{ticket.location.raw_text}</p>
                      <p className="text-xs text-ink-muted">
                        {ticket.location.intersection_street_1 ?? "—"} /{" "}
                        {ticket.location.intersection_street_2 ?? "—"} · postal
                        area {ticket.location.postal_code_or_fsa ?? "—"}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {ticket.location.ward ?? "—"}
                      </p>
                    </>
                  ),
                },
                {
                  label: "When seen",
                  value: (
                    <span
                      className="tabular-nums"
                      title={ticket.observed_at}
                    >
                      {formatTimestamp(ticket.observed_at)}
                    </span>
                  ),
                },
              ]}
            />
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint mb-2">
                Safety check
              </p>
              <SafetyAnswersReadout
                answers={ticket.safety_answers}
                flags={ticket.hazard_flags}
                fired={evidence.score_breakdown.hard_routes_triggered}
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint mb-2">
                Attachments
              </p>
              {attachments.length === 0 ? (
                <p className="text-sm text-ink-muted">No attachments.</p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
          id="category"
          title="Best matching categories"
          subtitle="What the system thinks this request is about, ranked by how well it matches."
          className="scroll-mt-24"
        >
          <ConfidenceList
            candidates={evidence.category_candidates}
            confidence={evidence.category_confidence}
            margin={evidence.category_margin}
          />
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
              Show technical details
            </summary>
            <div className="mt-2 flex flex-col gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ink-faint mb-1">
                  What we searched against the category list
                </p>
                <pre className="whitespace-pre-wrap font-mono text-[11px] text-ink bg-surface-alt p-2 border border-border rounded-[3px]">
                  {evidence.category_query_text}
                </pre>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ink-faint mb-1">
                  What we searched against past / open requests
                </p>
                <pre className="whitespace-pre-wrap font-mono text-[11px] text-ink bg-surface-alt p-2 border border-border rounded-[3px]">
                  {evidence.retrieval_query_text}
                </pre>
              </div>
              <p className="text-[11px] font-mono text-ink-faint">
                embedding: {evidence.embedding_ref.embedding_model} · dim{" "}
                {evidence.embedding_ref.embedding_dim} · hash{" "}
                {evidence.embedding_ref.structured_text_hash}
              </p>
            </div>
          </details>
        </Panel>

        <Panel
          id="urgency"
          title="How urgent is it?"
          className="scroll-mt-24"
        >
          {(() => {
            const urgencyStrength = describeStrength(evidence.urgency_score);
            return (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-base text-ink">
                    <span className="font-medium">
                      {urgencyLabels[evidence.urgency_decision].label}
                    </span>{" "}
                    <span
                      className="text-sm text-ink-muted tabular-nums"
                      title={`urgency_score=${evidence.urgency_score.toFixed(2)}`}
                    >
                      ({formatPercent(evidence.urgency_score)} on the urgency scale)
                    </span>
                  </p>
                  <p className="text-sm text-ink-muted mt-1">
                    {urgencyLabels[evidence.urgency_decision].hint}
                  </p>
                </div>
                <ScoreBar
                  value={evidence.urgency_score}
                  ticks={[0.45, 0.75]}
                  variant="urgency"
                />
                <p className="text-xs text-ink-muted">
                  The system flags requests for review above{" "}
                  <span className="font-mono">0.45</span> and sends them
                  straight to a person above{" "}
                  <span className="font-mono">0.75</span>.{" "}
                  <span className={urgencyStrength.className}>
                    {urgencyStrength.band} score.
                  </span>
                </p>
                <details>
                  <summary className="cursor-pointer text-sm text-ink-muted hover:text-ink">
                    Show how we got that score
                  </summary>
                  <div className="mt-3">
                    <ScoreBreakdown
                      breakdown={evidence.score_breakdown}
                      total={evidence.urgency_score}
                    />
                  </div>
                </details>
              </div>
            );
          })()}
        </Panel>

        <Panel
          id="historical"
          title="Past similar requests"
          subtitle="Completed 311 requests that look like this one. Useful for context — how was this kind of thing handled before?"
          className="scroll-mt-24"
        >
          {evidence.nearest_historical_records.length === 0 ? (
            <EmptyState title="No past requests look similar enough to show." />
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
          id="duplicates"
          title="Open requests that look like this one"
          className="scroll-mt-24"
          subtitle={
            evidence.duplicate_decision === "NOT_DUPLICATE"
              ? "Nothing open looks like a duplicate."
              : "Open requests that may already cover this issue."
          }
        >
          {evidence.active_duplicate_candidates.length === 0 ? (
            <EmptyState
              title="No likely duplicates"
              hint={
                <span
                  className="tabular-nums"
                  title={`duplicate_score=${evidence.duplicate_score.toFixed(2)}`}
                >
                  Duplicate confidence is only{" "}
                  {formatPercent(evidence.duplicate_score)} — below the
                  threshold to flag.
                </span>
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

        <Panel
          id="audit"
          title="What the system did, step by step"
          subtitle="Every decision can be traced back to one of these steps. Citations in the copilot answers link directly into this list."
          className="scroll-mt-24"
        >
          <ol className="flex flex-col gap-2">
            {audits.map((a) => (
              <li
                key={a.audit_id}
                id={a.audit_id}
                className="border border-border rounded-[3px] bg-surface-alt/30 px-3 py-2 scroll-mt-24 target:bg-civic-blue-soft target:border-civic-blue"
              >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-ink">
                        {STAGE_LABEL[a.stage] ?? a.stage}
                      </p>
                      <p
                        className="text-[11px] text-ink-faint tabular-nums"
                        title={a.timestamp}
                      >
                        {formatTimestamp(a.timestamp)}
                      </p>
                    </div>
                    <p className="text-sm text-ink mt-1">{a.summary}</p>
                    <p className="text-[10px] font-mono text-ink-faint mt-1">
                      {a.audit_id}
                    </p>
                  </li>
                ))}
              </ol>
        </Panel>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        <SectionSidebar title="On this page" items={sidebarItems} />
        <CopilotChatPanel
          ticket_id={id}
          availableTopics={availableTopics}
        />
      </aside>
    </div>
    </>
  );
}
