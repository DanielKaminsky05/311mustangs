# Resolution Engine System Plan

## Product goal

The system helps a government employee review incoming 311-style reports by detecting when a new WhatsApp request is probably related to an existing unresolved issue.

The finished system should turn a conversational citizen report into a traceable backend ticket, store it, embed it for semantic search, compare it against previously stored requests, and launch an async NemoClaw agent when deeper duplicate/urgency analysis is needed.

## End-to-end data flow

```text
1. Citizen talks with the WhatsApp intake agent conversationally.

2. The WhatsApp agent collects the minimum facts needed for a request:
   - description
   - street1 x street2 intersection when available
   - ward when available

3. The agent submits a signed request webhook to the backend.

4. The backend parses the request and creates durable SQLite records:
   - intake event / webhook event
   - ticket/request row
   - initial status = unresolved
   - normalized structured text used for embedding

5. The backend embeds the structured request text.

6. The backend stores the embedding in the local vector DB, keyed by the SQLite ticket ID.

7. The backend searches the vector DB for semantically similar stored requests.

8. If no strong similar unresolved request exists:
   - keep the ticket as a normal unresolved request
   - expose it to the dashboard as a new request

9. If a similar unresolved request exists:
   - create duplicate-candidate records in SQLite
   - launch an async NemoClaw analysis agent

10. The NemoClaw agent investigates candidate duplicates across available datasets, then writes back:
    - duplicate reasoning
    - ranked/evaluated urgency
    - evidence references
    - trace events
    - suggested employee action

11. The dashboard shows the government employee:
    - the incoming ticket
    - similar unresolved requests
    - duplicate count/evidence
    - agent trace
    - urgency/ranking suggestion
    - approve/reject/action controls
```

## Request text contract

The WhatsApp agent should submit one structured text block that is both human-readable and embedding-ready:

```text
TICKET_TEXT_V1
DESCRIPTION: <citizen issue description>
INTERSECTION: <street 1> x <street 2>
WARD: <ward or UNKNOWN>
```

This text is the canonical embedding input. The backend stores it exactly, hashes it, embeds it, and links the vector DB entry back to the SQLite ticket ID.

Images and media are out of scope for the current request webhook.

## Backend responsibilities

The backend owns:

- webhook authentication and idempotency;
- ticket ID generation;
- parsing the structured request text;
- SQLite persistence;
- unresolved/open status tracking;
- local embedding generation;
- vector DB upsert/search;
- duplicate-candidate creation;
- async NemoClaw agent launch;
- storing agent trace and suggestions;
- dashboard APIs.

The WhatsApp agent owns:

- conversational collection of facts;
- asking follow-up questions;
- producing the structured text request;
- submitting the signed webhook.

The WhatsApp agent should not decide final duplicate status, urgency, routing, or dashboard recommendation.

## Storage model

SQLite is the source of truth for application state. The vector DB is the semantic lookup index.

Core SQLite records:

```text
intake_events
  Stores webhook event ID, request payload, response payload, and idempotency state.

tickets
  Stores each accepted request, parsed fields, unresolved/resolved status, structured text, text hash, and vector reference.

duplicate_candidates
  Stores similar request matches returned from vector search, including score and candidate status.

agent_runs
  Stores async NemoClaw analysis jobs for tickets with likely duplicates.

agent_trace_events
  Stores the reasoning/tool trace produced by NemoClaw.

review_cases
  Stores the dashboard-facing case, recommendation, urgency/ranking result, and employee review state.
```

Vector DB records:

```text
point_id = SQLite ticket ID
vector = embedding(TICKET_TEXT_V1 block)
payload = ticket ID, status, text hash, intersection, ward
```

## Async NemoClaw analysis

NemoClaw should launch only when the backend finds a meaningful similar unresolved request.

Trigger condition:

```text
new ticket is unresolved
AND vector DB returns one or more similar unresolved candidates above threshold
```

NemoClaw output should be persisted, not just returned transiently:

```text
duplicate reasoning
ranked candidate list
urgency/ranking evaluation
evidence references
trace events
suggested employee action
```

## Dashboard outcome

The completed dashboard should let a government employee answer:

```text
What is this incoming issue?
Has something similar already been reported?
Is the similar request still unresolved?
Why does the agent think this is a duplicate?
How urgent is this compared with other unresolved reports?
What action should I take?
```

The dashboard does not run embeddings or agents directly. It reads persisted backend records and writes employee review actions back to SQLite.
