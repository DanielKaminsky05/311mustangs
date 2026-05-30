/**
 * Mock data for the 311mustangs operator dashboard.
 *
 * This stands in for the backend data contract described in
 * docs/planning/frontend.md ("Backend data contract"). Every value here would,
 * in the real system, come from SQLite / the DGX retrieval path — the UI only
 * ever *renders* these values, it never computes scores.
 *
 * Demo clock is pinned to 2026-01-15 20:00 (see docs/planning/data.md) so permit
 * and schedule date windows line up.
 */

export const DEMO_CLOCK = "2026-01-15T20:00:00";

// ---------------------------------------------------------------------------
// Types (mirror the planned backend tables)
// ---------------------------------------------------------------------------

export type DecisionLabel =
  | "DUPLICATE"
  | "AUTO_SCHEDULE"
  | "AUTO_SCHEDULE_PENDING_APPROVAL"
  | "HUMAN_REVIEW"
  | "AUTO_RESOLVE";

/** Deterministic scores — backend-owned, displayed read-only. */
export interface ScoreBreakdown {
  duplicate_score: number;
  historical_similarity_score: number;
  category_supported_score: number;
  public_safety_score: number;
  schedule_insertion_score: number;
  confidence_score: number;
}

/** A nearest historical 311 record returned by DGX vector search. */
export interface NearestRecord {
  id: string;
  similarity: number;
  service_request_type: string;
  status: "New" | "In Progress" | "Closed";
  ward: string;
  location: string;
  opened: string;
}

/** Metadata for a file attached to a request (request_attachments row). */
export interface Attachment {
  attachment_id: string;
  display_name: string;
  mime_type: string;
  size_bytes: number;
  /** Populated only if the DGX vision-grounding stretch path ran. */
  vision_caption?: string;
}

/** A candidate schedule insertion slot. */
export interface ScheduleCandidate {
  label: string;
  window: string;
  status: "accepted" | "rejected";
  reason: string;
}

export interface TriageDecision {
  label: DecisionLabel;
  summary: string;
  scores: ScoreBreakdown;
  nearest: NearestRecord[];
  /** The deterministic text that was embedded for retrieval. */
  structured_text: string;
  audit_log_id: string;
  schedule?: ScheduleCandidate[];
}

export interface ServiceRequest {
  id: string;
  description: string;
  service_request_type: string;
  location: string;
  ward: string;
  channel: "WhatsApp" | "Dashboard" | "Phone";
  submitted_at: string;
  attachments: Attachment[];
  decision: TriageDecision;
}

/** Scripted intake fixture for the demo-case picker on /submit. */
export interface DemoCase {
  key: string;
  title: string;
  description: string;
  service_request_type: string;
  location: string;
  ward: string;
  expected: DecisionLabel;
}

/** NVIDIA / Spark judging-proof metadata (data_pipeline_runs.metrics_json). */
export interface SparkMetrics {
  gpu_enabled: boolean;
  device_name: string;
  rapids_version: string;
  embedding_backend: string;
  embedding_model: string;
  vector_backend: string;
  records_indexed: number;
  open_data_rows: number;
  llm_backend: string;
  external_api_used: boolean;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const DECISION_META: Record<
  DecisionLabel,
  { label: string; tone: string; blurb: string }
> = {
  DUPLICATE: {
    label: "Duplicate",
    tone: "amber",
    blurb: "Matches an active request already in the system.",
  },
  AUTO_SCHEDULE: {
    label: "Auto-scheduled",
    tone: "emerald",
    blurb: "Low risk, supported category, no hard conflict — queued automatically.",
  },
  AUTO_SCHEDULE_PENDING_APPROVAL: {
    label: "Pending approval",
    tone: "sky",
    blurb: "Auto-scheduled but a constraint requires operator sign-off.",
  },
  HUMAN_REVIEW: {
    label: "Human review",
    tone: "rose",
    blurb: "Unsupported lane, high public-safety score, or low confidence.",
  },
  AUTO_RESOLVE: {
    label: "Auto-resolved",
    tone: "violet",
    blurb: "Resolved against open-data evidence (e.g. an active permit).",
  },
};

export const SCORE_LABELS: Record<keyof ScoreBreakdown, string> = {
  duplicate_score: "Duplicate",
  historical_similarity_score: "Historical similarity",
  category_supported_score: "Category supported",
  public_safety_score: "Public safety",
  schedule_insertion_score: "Schedule fit",
  confidence_score: "Confidence",
};

// ---------------------------------------------------------------------------
// Mock records
// ---------------------------------------------------------------------------

export const SPARK_METRICS: SparkMetrics = {
  gpu_enabled: true,
  device_name: "NVIDIA GB10 Grace Blackwell (DGX Spark / ASUS GX10)",
  rapids_version: "cuDF 25.02",
  embedding_backend: "NVIDIA NIM",
  embedding_model: "nv-embed-qa (1024-d)",
  vector_backend: "cuVS (IVF-PQ)",
  records_indexed: 193_482,
  open_data_rows: 248_911,
  llm_backend: "TensorRT-LLM (local, Llama-3.1-8B)",
  external_api_used: false,
};

export const SERVICE_REQUESTS: ServiceRequest[] = [
  {
    id: "SR-2026-004411",
    description:
      "Graffiti on the public street sign at Wychwood Ave near Tyrrel Ave. Tags cover most of the sign face.",
    service_request_type: "Graffiti - Street Sign",
    location: "Wychwood Ave (near Tyrrel Ave)",
    ward: "Ward 12 - Toronto-St. Paul's",
    channel: "WhatsApp",
    submitted_at: "2026-01-15T19:42:00",
    attachments: [
      {
        attachment_id: "att_8f21",
        display_name: "wychwood-sign.jpg",
        mime_type: "image/jpeg",
        size_bytes: 2_418_322,
        vision_caption: "Street sign defaced with spray-paint tags, daytime",
      },
    ],
    decision: {
      label: "AUTO_SCHEDULE_PENDING_APPROVAL",
      summary:
        "Supported cleanup lane with high historical similarity. First insertion slot is blocked by an active utility-cut window, so the next safe slot is proposed pending operator approval.",
      scores: {
        duplicate_score: 0.18,
        historical_similarity_score: 0.86,
        category_supported_score: 0.95,
        public_safety_score: 0.22,
        schedule_insertion_score: 0.71,
        confidence_score: 0.88,
      },
      structured_text:
        "graffiti street sign | wychwood ave between tyrrel ave and helena ave | ward 12 | division transportation services | status new",
      audit_log_id: "audit_a1c9",
      nearest: [
        {
          id: "SR-2025-187233",
          similarity: 0.91,
          service_request_type: "Graffiti - Street Sign",
          status: "Closed",
          ward: "Ward 12 - Toronto-St. Paul's",
          location: "Christie St near Benson Ave",
          opened: "2025-08-04",
        },
        {
          id: "SR-2025-201880",
          similarity: 0.88,
          service_request_type: "Graffiti - Public Property",
          status: "Closed",
          ward: "Ward 11 - University-Rosedale",
          location: "Bathurst St near Dupont St",
          opened: "2025-09-19",
        },
        {
          id: "SR-2025-166104",
          similarity: 0.83,
          service_request_type: "Damaged Sign",
          status: "Closed",
          ward: "Ward 12 - Toronto-St. Paul's",
          location: "Davenport Rd near Ossington Ave",
          opened: "2025-06-28",
        },
      ],
      schedule: [
        {
          label: "Candidate A",
          window: "2026-01-15 14:00 — 16:00",
          status: "rejected",
          reason:
            "BLOCKED_BY_UTILITY_CUT — permit 1021444006 active on Wychwood Ave through 2026-01-15.",
        },
        {
          label: "Candidate B",
          window: "2026-01-16 10:00 — 12:00",
          status: "accepted",
          reason: "Utility-cut window has ended; crew route has open capacity.",
        },
      ],
    },
  },
  {
    id: "SR-2026-004417",
    description:
      "Same graffiti-covered sign at Wychwood Ave and Tyrrel Ave reported again by a different resident.",
    service_request_type: "Graffiti - Street Sign",
    location: "Wychwood Ave (near Tyrrel Ave)",
    ward: "Ward 12 - Toronto-St. Paul's",
    channel: "Dashboard",
    submitted_at: "2026-01-15T19:58:00",
    attachments: [],
    decision: {
      label: "DUPLICATE",
      summary:
        "Near-identical to active request SR-2026-004411 (same category and location tokens), already scheduled. No new operation created.",
      scores: {
        duplicate_score: 0.97,
        historical_similarity_score: 0.93,
        category_supported_score: 0.95,
        public_safety_score: 0.2,
        schedule_insertion_score: 0.0,
        confidence_score: 0.96,
      },
      structured_text:
        "graffiti street sign | wychwood ave near tyrrel ave | ward 12 | status new",
      audit_log_id: "audit_b2d0",
      nearest: [
        {
          id: "SR-2026-004411",
          similarity: 0.98,
          service_request_type: "Graffiti - Street Sign",
          status: "In Progress",
          ward: "Ward 12 - Toronto-St. Paul's",
          location: "Wychwood Ave (near Tyrrel Ave)",
          opened: "2026-01-15",
        },
        {
          id: "SR-2025-187233",
          similarity: 0.9,
          service_request_type: "Graffiti - Street Sign",
          status: "Closed",
          ward: "Ward 12 - Toronto-St. Paul's",
          location: "Christie St near Benson Ave",
          opened: "2025-08-04",
        },
      ],
    },
  },
  {
    id: "SR-2026-004420",
    description:
      "Loud amplified construction noise near 1 Delisle Ave around 8 PM. Caller reports it's been going for hours.",
    service_request_type: "Noise Complaint",
    location: "1 Delisle Ave",
    ward: "Ward 12 - Toronto-St. Paul's",
    channel: "Phone",
    submitted_at: "2026-01-15T20:04:00",
    attachments: [],
    decision: {
      label: "HUMAN_REVIEW",
      summary:
        "Noise auto-resolution lane is deferred for the MVP. Similar historical noise records exist, but permit evidence lookup is not wired, so the request is routed to a human operator.",
      scores: {
        duplicate_score: 0.31,
        historical_similarity_score: 0.74,
        category_supported_score: 0.4,
        public_safety_score: 0.55,
        schedule_insertion_score: 0.0,
        confidence_score: 0.49,
      },
      structured_text:
        "noise complaint amplified construction | 1 delisle ave | ward 12 | evening | status new",
      audit_log_id: "audit_c3e1",
      nearest: [
        {
          id: "SR-2025-099812",
          similarity: 0.79,
          service_request_type: "Noise Complaint",
          status: "Closed",
          ward: "Ward 12 - Toronto-St. Paul's",
          location: "Yonge St near St Clair Ave",
          opened: "2025-07-12",
        },
        {
          id: "SR-2025-143209",
          similarity: 0.72,
          service_request_type: "Noise Complaint",
          status: "Closed",
          ward: "Ward 11 - University-Rosedale",
          location: "Spadina Ave near College St",
          opened: "2025-08-30",
        },
      ],
    },
  },
  {
    id: "SR-2026-004402",
    description:
      "Minor debris and a fallen branch on the sidewalk along Davenport Rd. Not blocking the road.",
    service_request_type: "Sidewalk - Debris / Litter",
    location: "Davenport Rd near Ossington Ave",
    ward: "Ward 9 - Davenport",
    channel: "WhatsApp",
    submitted_at: "2026-01-15T18:21:00",
    attachments: [
      {
        attachment_id: "att_1b07",
        display_name: "branch-debris.png",
        mime_type: "image/png",
        size_bytes: 1_204_553,
        vision_caption: "Fallen tree branch and litter on a sidewalk",
      },
    ],
    decision: {
      label: "AUTO_SCHEDULE",
      summary:
        "Low public-safety score, supported cleanup lane, no conflicting permits. Inserted into the Ward 9 cleanup queue automatically.",
      scores: {
        duplicate_score: 0.09,
        historical_similarity_score: 0.81,
        category_supported_score: 0.9,
        public_safety_score: 0.18,
        schedule_insertion_score: 0.84,
        confidence_score: 0.9,
      },
      structured_text:
        "sidewalk debris litter fallen branch | davenport rd near ossington ave | ward 9 | status new",
      audit_log_id: "audit_d4f2",
      nearest: [
        {
          id: "SR-2025-178too",
          similarity: 0.85,
          service_request_type: "Sidewalk - Debris / Litter",
          status: "Closed",
          ward: "Ward 9 - Davenport",
          location: "Dupont St near Lansdowne Ave",
          opened: "2025-10-02",
        },
      ],
      schedule: [
        {
          label: "Candidate A",
          window: "2026-01-16 08:00 — 10:00",
          status: "accepted",
          reason: "No conflicts; nearest open slot on the Ward 9 cleanup route.",
        },
      ],
    },
  },
  {
    id: "SR-2026-004388",
    description:
      "Large pothole in the live traffic lane on Bathurst St, vehicles swerving to avoid it.",
    service_request_type: "Pothole - Roadway",
    location: "Bathurst St near Dupont St",
    ward: "Ward 11 - University-Rosedale",
    channel: "Phone",
    submitted_at: "2026-01-15T17:05:00",
    attachments: [],
    decision: {
      label: "HUMAN_REVIEW",
      summary:
        "High public-safety score (live traffic lane). Escalated to a human operator regardless of similarity — auto-scheduling is not permitted for high-risk roadway hazards.",
      scores: {
        duplicate_score: 0.12,
        historical_similarity_score: 0.69,
        category_supported_score: 0.6,
        public_safety_score: 0.92,
        schedule_insertion_score: 0.0,
        confidence_score: 0.83,
      },
      structured_text:
        "pothole roadway live traffic lane | bathurst st near dupont st | ward 11 | status new",
      audit_log_id: "audit_e5g3",
      nearest: [
        {
          id: "SR-2025-150220",
          similarity: 0.74,
          service_request_type: "Pothole - Roadway",
          status: "Closed",
          ward: "Ward 11 - University-Rosedale",
          location: "Harbord St near Spadina Ave",
          opened: "2025-11-18",
        },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Demo-case fixtures (scripted intake for /submit)
// ---------------------------------------------------------------------------

export const DEMO_CASES: DemoCase[] = [
  {
    key: "wychwood-graffiti",
    title: "Graffiti / damaged sign — Wychwood Ave",
    description:
      "Graffiti on the public street sign at Wychwood Ave near Tyrrel Ave.",
    service_request_type: "Graffiti - Street Sign",
    location: "Wychwood Ave (near Tyrrel Ave)",
    ward: "Ward 12 - Toronto-St. Paul's",
    expected: "AUTO_SCHEDULE_PENDING_APPROVAL",
  },
  {
    key: "wychwood-duplicate",
    title: "Duplicate — same Wychwood sign again",
    description:
      "Same graffiti-covered sign at Wychwood Ave and Tyrrel Ave reported again.",
    service_request_type: "Graffiti - Street Sign",
    location: "Wychwood Ave (near Tyrrel Ave)",
    ward: "Ward 12 - Toronto-St. Paul's",
    expected: "DUPLICATE",
  },
  {
    key: "delisle-noise",
    title: "Noise complaint — 1 Delisle Ave",
    description: "Amplified construction noise near 1 Delisle Ave around 8 PM.",
    service_request_type: "Noise Complaint",
    location: "1 Delisle Ave",
    ward: "Ward 12 - Toronto-St. Paul's",
    expected: "HUMAN_REVIEW",
  },
  {
    key: "bathurst-pothole",
    title: "Pothole — live traffic lane, Bathurst St",
    description: "Large pothole in the live traffic lane on Bathurst St.",
    service_request_type: "Pothole - Roadway",
    location: "Bathurst St near Dupont St",
    ward: "Ward 11 - University-Rosedale",
    expected: "HUMAN_REVIEW",
  },
];

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

export function getRequest(id: string): ServiceRequest | undefined {
  return SERVICE_REQUESTS.find((r) => r.id === id);
}

export function getPendingApprovals(): ServiceRequest[] {
  return SERVICE_REQUESTS.filter(
    (r) =>
      r.decision.label === "AUTO_SCHEDULE_PENDING_APPROVAL" ||
      r.decision.label === "HUMAN_REVIEW",
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
