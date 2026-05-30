## Solution Proposal

Create a proof of concept demo solution with the following component responsibilities:

| Component | Where it runs | Responsibility |
|---|---|---|
| **Web dashboard / request intake** | Dev server | Represents the operator-facing 311 scheduling view and the demo request submission flow. Shows triage outcomes, evidence, schedule changes, and human approval prompts. |
| **Backend API** | Dev server | Orchestrates request normalization, triage, evidence lookup, graph/scheduler calls, persistence, and dashboard events. See [`backend.md`](./backend.md) for Redis, SQLite, and API details. |
| **SQLite database** | Dev server | Durable source of truth for service requests, open-data records, operations, dependencies, schedule assignments, triage decisions, and audit logs. |
| **Redis** | Dev server | Live/materialized graph cache, schedule cache, event bus, locks, and short-lived queues. Redis is rebuildable from SQLite and is not the durable source of truth. |
| **Graph engine** | Dev server | Builds the active operation DAG from SQLite, validates constraints, checks utility-cut conflicts, and ranks valid schedule insertion options. |
| **Vector DB / vector index** | DGX Spark preferred | Stores/searches embeddings for the 311 corpus and returns nearest historical records for duplicate detection and grounding. |
| **Inference service** | DGX Spark only | Runs embedding inference and any LLM inference. The dev server calls this service; model inference does not run on the dev server. |
| **Agent orchestration layer** | Dev server, model calls on DGX Spark | Calls audited backend tools, explains tool outputs, and requests human approval. It does not invent scores, constraints, or schedule updates. |

We create a full end-to-end solution from an agent-augmented service request submission flow to globally optimized deployment scheduling.

When a service request is submitted:

1. the service form from the agent from the whatsapp frontend is vector embedded and goes through our custom ranking pipeline to determine the following. **Note that no LLMs opaque reasoning is used for ranking the priority of the calls and it is through our scoring engine built on embeddings**:
    1. priority classification: “How urgent is this issue? Will this require a human directly, or is it a minor issue?”
    2. Uniqueness & Similarity to existing issues (NNS + metadata filtering): Deduplicate issues - “has this issue been reported already, and does it require a trained and experienced human operator to make executive decisions?”

We are delivering a full comprehensive system that drives deployment and operation speed up by optimizing the slowness of a bureaucratic system only for low urgency and low priority items using AI agents as operations orchestrators. 

After “ranking”, the call either:
- Gets routed to a human operator to take over 
- Gets identified as an existing item that is already marked as in progress or registered in the system
- Gets marked as a low priority (significance) and low urgency item, which our system then takes into action and schedules directly in the system.

### Scheduling - DEFERRED UNTIL MVP IS COMPLETE 

In classical scheduling, sequential operations (note that there can be multiple categories of sequential operations for each team) are scheduled. We model the workflow as a DAG, and connect relationships (time and geospatial metadata) to a multi layer network representing information/metadata related to said operation represented in the DAG as a single node.

- time: when the operation was scheduled for. This may be redundant because the DAG may already inherently represent that
- space: street categorical groupings, longitude and latitude (depends on frontend information)
- closeness in semantic meaning: how closely connected 

> NOTE: the agent does not traverse the graph directly; the agent calls a tool and the underlying graph engine uses this.

MVP graph decision: use **SQLite as the durable source of truth** and **Redis as the live/materialized graph instance**. Do not introduce a graph database for the hackathon path. The backend graph engine rebuilds the active DAG from SQLite, caches the working graph in Redis, validates constraints, and writes all final decisions back to SQLite.

Grounding rule: the agent does not decide whether the DAG is valid or optimal from free-form reasoning. It calls backend tools that return similar-record evidence, permit/conflict evidence, valid insertion candidates, score breakdowns, and audit logs.

1. **For low-priority decisions**: the backend can schedule asynchronously and the dashboard receives pending operations for operator approval.
2. **For high-priority or important decisions**: a human operator must approve or oversee the scheduling/planning process.

### Data Usage Proposal: resolved MVP scope

One of the main requirements is that the agent must be grounded in real data from the Toronto Open Data Portal.

For the hackathon MVP, the working scope is narrowed in [`data.md`](./data.md) to **three datasets**: 311 Service Requests, Noise Exemption Permits, and Utility Cut Permits. Watermain Breaks and Solid Waste Collection Schedule remain useful follow-ups, but they are intentionally excluded from the barebones demo to avoid stale-current-state claims and extra lookup layers.

Original candidate datasets from the 543-dataset scrape were:

- 311 Service Requests - Customer Initiated: MVP usage is local embedding/indexing, duplicate detection, deterministic category priors, and seeded active operations. Do **not** spend the MVP timeline on fine-tuning.
- Watermain Breaks - DEFERRED: Strong historical geospatial corpus, but excluded from the MVP because the available file ends in 2016; do not present it as active known-issue data unless seeding clearly synthetic demo state.
- Noise Exemption Permits: MVP usage is evidence-backed noise complaint auto-resolution or bylaw escalation.
- Utility Cut Permits - DEFERRED: MVP usage is schedule constraints so a cleanup/sign/graffiti crew is not sent into an active utility work window.
- Solid Waste Collection Schedule: Useful later for missed-garbage auto-resolution, but excluded from the MVP because it needs a caller calendar/zone lookup layer.


