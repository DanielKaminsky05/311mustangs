# Agent Planning Notes

## Main feedback

The agent should not be the source of truth for priority, deduplication, or scheduling.

The agent should be an orchestration and explanation layer over deterministic tools.

Strong framing:

> The agent does not decide. The agent calls audited tools, explains the evidence, and asks humans for approval when required.

This avoids the common “LLM magically runs the city” problem.

## Agent responsibilities

Good agent responsibilities:

- summarize an incoming request for an operator
- call triage/scoring tools
- call duplicate search tools
- call open-data lookup tools
- call scheduler recompute tools
- explain why a decision was made
- generate citizen-facing responses
- ask for human approval
- compare optimized schedule against FIFO/manual baseline
- surface uncertainty and escalation reasons

Bad agent responsibilities:

- directly assigning priority from free-form reasoning
- inventing constraints
- overriding the optimizer
- silently auto-approving high-risk work
- creating schedules without tool calls
- claiming global optimality without objective/constraints

## Suggested agent tools

Expose backend functions as tools such as:

```text
submit_service_request
classify_request
find_similar_requests
lookup_open_data_events
score_resolution_path
create_operation_from_request
recompute_schedule
explain_decision
request_human_approval
```

Each tool should return structured evidence, not just prose.

Example tool result:

```json
{
  "decision": "DUPLICATE",
  "confidence": 0.89,
  "evidence": [
    {
      "type": "similar_request",
      "request_id": "1842",
      "semantic_similarity": 0.91,
      "distance_meters": 73,
      "status": "open"
    }
  ],
  "recommended_action": "attach_to_existing_request"
}
```

## Human-in-the-loop policy

Clear policy is important.

Suggested rules:

```text
High public safety risk → human required
Low confidence → human required
Ambiguous category → human required
Conflicting open-data evidence → human required
Low-priority + high confidence + no conflicts → auto-schedule proposal
Auto-scheduled work → operator approval before dispatch
```

The agent should make this policy visible.

## Agent modes

Consider two modes:

### 1. Citizen assistant

Purpose:

- help submit complete request
- clarify location/category
- provide status if issue is known/duplicate
- generate citizen-friendly response

This can be mostly scripted/tool-driven.

### 2. Operator assistant

Purpose:

- explain triage results
- show evidence
- answer “why was this routed this way?”
- recompute schedule under operator constraints
- draft approval/rejection rationale

The operator assistant is more important for judging.

## Grounding requirements

Every agent answer should cite one or more of:

- request fields
- historical 311 records
- open-data records
- scoring engine output
- vector similarity result
- scheduler output
- configured policy threshold

Avoid ungrounded responses like:

> This seems urgent.

Prefer:

> This was escalated because public_safety_score=0.86 exceeded the 0.75 threshold, the description contains “blocked lane,” and no matching active work order was found nearby.

## Explanation pattern

Use a consistent explanation format:

```text
Decision
Confidence
Evidence
Policy threshold triggered
Recommended action
Human approval requirement
```

Example:

```text
Decision: AUTO_RESOLVE
Confidence: 0.92
Evidence: Active watermain break record 118m from submitted location, opened today.
Policy: Known issue score exceeded auto-resolution threshold.
Action: Attach citizen report to existing issue and return status update.
Human approval: Not required.
```

## Agent and scheduling

The agent can ask the scheduler for alternatives, but the optimizer should produce schedules.

Useful operator prompts:

- “Recompute using one fewer crew.”
- “Prioritize Ward 10 today.”
- “Avoid Queen St after 4 PM.”
- “Show what changes if this graffiti job is delayed until tomorrow.”

The agent should translate these into structured constraints and call the scheduler.

## Safety/credibility notes

The project is more credible if the agent frequently says when it cannot decide.

Escalation is not failure. It is part of the product.

The best demo is not full autonomy. The best demo is:

- automatic handling of safe low-risk cases
- clear escalation of risky cases
- evidence-backed operator decisions
- fast optimized scheduling for low-priority work
