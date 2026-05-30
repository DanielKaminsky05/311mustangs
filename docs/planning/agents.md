# Agent responsibilities

## WhatsApp / NemoClaw intake agent

The WhatsApp-facing agent is responsible for **information gathering only**. It should not make final category, urgency, duplicate, or scheduling decisions.

Its job is to keep asking follow-up questions until the backend has enough structured information to run the 311 data pipeline.

Minimum information to extract:

```text
issue description             # free-text citizen report, required
location raw text             # user's location phrasing, required
observed_at                   # when the issue was observed/reported, required or backend-filled
intersection_street_1         # preferred when user gives an intersection
intersection_street_2         # preferred when user gives an intersection
postal_code_or_fsa            # preferred when available
ward                          # optional; backend may infer later if possible
latitude / longitude          # optional; useful if frontend/map can provide it
media_refs                    # optional image/video references
safety_answers                # explicit user yes/no/unknown answers, not agent hazard classification
```

Required safety answer keys:

```text
injury
active_danger
blocking_road
blocking_sidewalk
flooding
sewage_or_water_issue
traffic_signal_issue
```

Allowed answer values are `yes`, `no`, and `unknown`. The intake agent may record `yes` only when the user explicitly answers yes or directly states the condition. Otherwise it should ask a follow-up or record `unknown`.

The intake agent may explain that it is collecting details for city review, but it must avoid presenting itself as the authority for final classification, urgency, hazards, or routing.

Minimum backend payload:

```json
{
  "source": "whatsapp",
  "description": "There is graffiti on a stop sign near Wychwood and Tyrrel.",
  "location": {
    "raw_text": "Wychwood Ave and Tyrrel Ave",
    "intersection_street_1": "Wychwood Ave",
    "intersection_street_2": "Tyrrel Ave",
    "postal_code_or_fsa": "M6G",
    "ward": null,
    "latitude": null,
    "longitude": null
  },
  "observed_at": "2026-01-15T20:00:00",
  "safety_answers": {
    "injury": "no",
    "active_danger": "no",
    "blocking_road": "no",
    "blocking_sidewalk": "no",
    "flooding": "no",
    "sewage_or_water_issue": "no",
    "traffic_signal_issue": "no"
  },
  "media_refs": []
}
```

## Backend triage pipeline

The backend is responsible for converting the intake payload into auditable data signals. It should:

1. validate the incoming JSON;
2. normalize fields into the backend canonical ticket schema;
3. generate deterministic `structured_text` for embedding;
4. call the DGX Spark embedding/search service;
5. infer candidate 311 categories with uncertainty;
6. retrieve similar historical records;
7. retrieve active duplicate candidates;
8. compute deterministic urgency and routing scores;
9. persist the ticket, evidence, scores, and decision.

The backend should not embed raw JSON directly. It should embed a stable text form such as:

```text
Reported issue: There is graffiti on a stop sign near Wychwood and Tyrrel.
Location: Wychwood Ave and Tyrrel Ave. Postal area: M6G.
Safety signals reported: none.
```

The full `safety_answers` and backend-normalized `hazard_flags` remain stored for audit and deterministic urgency scoring.

## Backend scheduling / reasoning agent

The scheduling or reasoning agent runs **after** the backend has produced category candidates, urgency score, duplicate evidence, and routing decision.

It should receive an evidence pack, not raw authority to invent scores:

```json
{
  "ticket_id": "...",
  "normalized_ticket": {},
  "category_candidates": [],
  "urgency_score": 0.22,
  "urgency_decision": "LOW_URGENCY_SCHEDULING",
  "duplicate_score": 0.12,
  "nearest_historical_records": [],
  "active_duplicate_candidates": [],
  "score_breakdown": {},
  "audit_refs": []
}
```

For low-urgency tickets, it can suggest where to place the operation in the existing schedule. For high-urgency tickets, it should route to human workflow and provide evidence-backed category/division/section suggestions.

# Data flow

## 1. Intake

```text
Citizen on WhatsApp
  -> NemoClaw intake agent asks for missing details
  -> frontend/agent sends minimum JSON payload to backend
```

The payload must include at least:

```text
description
location.raw_text or another usable location signal
observed_at or backend report timestamp
safety_answers
```

Intersection, FSA/postal code, ward, and lat/lon should be included whenever available because duplicate detection is only strong when location is specific.

## 2. Backend validation and normalization

```text
incoming JSON
  -> schema validation
  -> required-field checks
  -> normalize blank/unknown values
  -> normalize timestamp
  -> normalize location fields
  -> canonical ticket record
```

If required fields are missing, the backend should return a structured `NEEDS_MORE_INFO` response that the WhatsApp agent can use to ask a follow-up question.

## 3. JSON-to-text construction

The backend creates `structured_text` from the validated ticket. This text is the embedding input.

The historical SR2026 rows also use deterministic structured text, built from available columns:

```text
Service request type: {service_request_type}.
Division: {division}.
Section: {section}.
Status: {status}.
Ward: {ward}.
Postal area: {first_3_chars_of_postal_code}.
Intersection: {intersection_street_1} and {intersection_street_2}.
```

The raw normalized JSON is stored for audit. The structured text is embedded.

## 4. Embedding indexes

The pipeline should maintain three retrieval targets.

### Category taxonomy index

Built from unique SR2026 category triples:

```text
service_request_type + division + section
```

Purpose:

```text
infer likely 311 category
generate category confidence distribution
suggest division/section for human reviewer or scheduler
```

Example embedded text:

```text
Service request category: Road Pothole / Road Damage.
Division: Transportation Services.
Section: Road Operations.
```

### Historical request index

Built from all normalized historical service request rows.

Purpose:

```text
find similar historical incidents
provide evidence/examples
support category priors and workload context
```

### Active duplicate index

Built from rows where:

```text
status in ["New", "In Progress"]
```

Purpose:

```text
retrieve possible active duplicates
then apply deterministic metadata filtering before marking duplicate
```

## 5. Category inference with uncertainty

```text
incoming ticket structured_text
  -> embed on DGX Spark
  -> nearest-neighbor search against category taxonomy index
  -> top K category candidates
  -> normalize similarities into confidence weights
```

Example result:

```json
[
  {
    "service_request_type": "Road Pothole / Road Damage",
    "division": "Transportation Services",
    "section": "Road Operations",
    "confidence": 0.57
  },
  {
    "service_request_type": "Road - Sinking",
    "division": "Transportation Services",
    "section": "Road Operations",
    "confidence": 0.30
  },
  {
    "service_request_type": "Damaged Concrete Sidewalk",
    "division": "Transportation Services",
    "section": "Road Operations",
    "confidence": 0.13
  }
]
```

If the top confidence is low or the margin between the first and second category is small, the backend should mark category confidence as uncertain and route to human review or request clarification.

## 6. Duplicate detection

Duplicate detection is hybrid:

```text
vector search finds candidates
metadata rules decide whether duplicate evidence is strong enough
```

Strong duplicate evidence:

```text
same or highly similar inferred category
active status: New or In Progress
same intersection streets
same ward or FSA
recent report time
high embedding similarity
```

Weak duplicate evidence:

```text
same category but only same ward
same category but only same FSA
no intersection/address/lat-lon
old completed records
```

Decision outputs should distinguish:

```text
DUPLICATE
POSSIBLE_DUPLICATE
NOT_DUPLICATE
```

Only strong active matches should become `DUPLICATE`. Weak matches should remain evidence for review or scheduling context.

## 7. Urgency scoring

Urgency is not learned directly from SR2026 because the dataset has no true urgency label. It should be a transparent weighted ruleset.

Inputs:

```text
category confidence distribution
backend-normalized hazard flags derived from explicit safety_answers
keyword/rule matches from description
optional duplicate/workload context
```

Recommended formula:

```text
category_base_score = weighted average of urgency base scores across category candidates
rules_score = category_base_score + hazard_boosts + keyword_boosts - penalties
urgency_score = clamp(rules_score, 0.0, 1.0)
```

Example category uncertainty weighting:

```text
0.57 * urgency("Road Pothole / Road Damage")
+ 0.30 * urgency("Road - Sinking")
+ 0.13 * urgency("Damaged Concrete Sidewalk")
```

Suggested routing thresholds:

```text
urgency_score >= 0.75      -> HIGH_URGENCY_HUMAN_REVIEW
0.45 <= urgency_score < .75 -> MEDIUM_REVIEW_OR_QUEUE
urgency_score < 0.45       -> LOW_URGENCY_SCHEDULING
```

Hard route flags derived from explicit `safety_answers` should override the numeric score:

```text
safety_answers.injury=yes -> hazard_flags.injury=true
safety_answers.active_danger=yes -> hazard_flags.active_danger=true
safety_answers.traffic_signal_issue=yes -> hazard_flags.traffic_signal_issue=true
```

These should always force human review after backend normalization.

## 8. Low-urgency scheduling handoff

For low-urgency tickets:

```text
scored ticket + inferred category + duplicate evidence
  -> scheduling/reasoning agent
  -> compare against existing scheduled operations
  -> suggest insertion or batching by ward/category/location tokens
  -> persist explanation and audit evidence
```

For high-urgency tickets:

```text
scored ticket + inferred category + evidence
  -> human workflow
  -> show suggested service_request_type/division/section
  -> show nearest historical and active records
  -> do not auto-schedule
```
