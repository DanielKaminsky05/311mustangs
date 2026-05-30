/**
 * Type shapes mirror docs/planning/data-pipeline.md.
 * When this file disagrees with data-pipeline.md, data-pipeline.md wins.
 *
 * Note: pure type module — shared with both Server Components and Client
 * Components (e.g. HazardFlagGridForm). Do not add server-only side-effect
 * imports here.
 */

export type HazardFlag = boolean | null;

export type HazardFlags = {
  injury: HazardFlag;
  active_danger: HazardFlag;
  blocking_road: HazardFlag;
  blocking_sidewalk: HazardFlag;
  flooding: HazardFlag;
  sewage_or_water_issue: HazardFlag;
  traffic_signal_issue: HazardFlag;
};

export const HAZARD_FLAG_KEYS = [
  "injury",
  "active_danger",
  "blocking_road",
  "blocking_sidewalk",
  "flooding",
  "sewage_or_water_issue",
  "traffic_signal_issue",
] as const satisfies readonly (keyof HazardFlags)[];

export const HARD_ROUTE_FLAG_KEYS = [
  "injury",
  "active_danger",
  "traffic_signal_issue",
] as const satisfies readonly (keyof HazardFlags)[];

export type CanonicalLocation = {
  raw_text: string;
  intersection_street_1: string | null;
  intersection_street_2: string | null;
  postal_code_or_fsa: string | null;
  ward: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type CanonicalTicket = {
  ticket_id: string;
  source: "whatsapp" | "operator_console" | "demo";
  description: string;
  location: CanonicalLocation;
  observed_at: string;
  reported_at: string;
  hazard_flags: HazardFlags;
  media_refs: string[];
  metadata: Record<string, unknown>;
};

export type CategoryCandidate = {
  service_request_type: string;
  division: string;
  section: string;
  similarity: number;
  confidence: number;
};

export type NearestRecord = {
  record_id: string;
  similarity: number;
  service_request_type: string;
  division: string;
  section: string;
  ward: string | null;
  intersection_street_1: string | null;
  intersection_street_2: string | null;
  status: string;
  creation_date: string;
  structured_text: string;
  // Optional metadata-filter signal that drove duplicate_decision
  filter_match?: string[];
};

export type CategoryDecision = "SUGGESTED_CATEGORY" | "UNCERTAIN_CATEGORY";
export type DuplicateDecision =
  | "DUPLICATE"
  | "POSSIBLE_DUPLICATE"
  | "NOT_DUPLICATE";
export type UrgencyDecision =
  | "HIGH_URGENCY_HUMAN_REVIEW"
  | "MEDIUM_REVIEW_OR_QUEUE"
  | "LOW_URGENCY_SCHEDULING";
export type Route =
  | "SCHEDULING_AGENT"
  | "HUMAN_WORKFLOW"
  | "DUPLICATE_WORKFLOW";

export type EvidencePack = {
  ticket_id: string;
  category_candidates: CategoryCandidate[];
  category_confidence: number;
  category_margin: number;
  category_decision: CategoryDecision;
  nearest_historical_records: NearestRecord[];
  active_duplicate_candidates: NearestRecord[];
  duplicate_decision: DuplicateDecision;
  duplicate_score: number;
  urgency_score: number;
  urgency_decision: UrgencyDecision;
  score_breakdown: {
    category_base_score: number;
    hazard_boost_total: number;
    keyword_boost_total: number;
    penalty_total: number;
  };
  hard_route_flags: (keyof HazardFlags)[];
  route: Route;
  audit_refs: string[];
  structured_text: string;
};

export type AuditEntry = {
  audit_id: string;
  ticket_id: string;
  stage:
    | "validation"
    | "structured_text"
    | "category_inference"
    | "historical_similarity"
    | "duplicate_retrieval"
    | "urgency_scoring"
    | "routing";
  timestamp: string;
  summary: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
};

export type PipelineMetrics = {
  gpu_enabled: boolean;
  device: string;
  rapids_cudf_version: string;
  embedding_backend: string;
  embedding_model: string;
  llm_runtime: string;
  llm_intake_model: string;
  llm_reasoning_model: string;
  vector_backend: string;
  records_indexed: number;
  active_records: number;
  no_external_api_in_triage_path: boolean;
  indexed_at: string;
  data_pipeline_report_path: string;
};

export type DemoCase = {
  case_id: string;
  title: string;
  blurb: string;
  canonical_ticket: Omit<CanonicalTicket, "ticket_id" | "reported_at">;
};

export type CopilotScript = Record<
  string,
  Record<string, { text: string; audit_refs: string[] }>
>;

export type Operation = {
  operation_id: string;
  category: string;
  ward: string;
  intersection: string;
  status: "scheduled" | "in_progress" | "completed";
  scheduled_for: string;
};

export type ScheduleAssignment = {
  assignment_id: string;
  ticket_id: string;
  category: string;
  proposed_slot: string;
  rank: number;
  explanation: string;
  batches_with: string | null; // operation_id
};

export type ApprovalEntry = {
  ticket_id: string;
  firing_reason: string;
  status: "pending" | "approved" | "overridden" | "sent_to_human";
  decided_at: string | null;
  decided_by: string | null;
};

export type AttachmentRecord = {
  attachment_id: string;
  request_id: string | null;
  display_name: string;
  mime_type: string;
  size_bytes: number;
  checksum: string;
  storage_scope: "temp" | "req";
  storage_path: string;
  created_at: string;
};
