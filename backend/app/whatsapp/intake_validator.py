"""Structured-ticket validation + pipeline-stub.

This module enforces the contract from `docs/planning/whatsapp-api.md`:

- description non-empty
- location has raw_text OR at least one structured field
- safety_answers complete (7 keys, yes/no/unknown)

`unknown` safety answers are valid and MUST NOT be coerced to `no`.

When the contract is satisfied we return a placeholder ACCEPTED with a fake
ticket_id and an empty evidence_pack. The full pipeline (embed → vector
search → category → duplicate → urgency) is deliberately not built here; it
plugs in where `_run_pipeline_stub` sits today.
"""

from datetime import datetime, timezone
from uuid import uuid4

from app.whatsapp.schemas import (
    Accepted,
    FollowUpPrompt,
    NeedsMoreInfo,
    TicketIntake,
)


def _check_missing(ticket: TicketIntake) -> list[FollowUpPrompt]:
    prompts: list[FollowUpPrompt] = []

    if not ticket.description or not ticket.description.strip():
        prompts.append(
            FollowUpPrompt(
                field="description",
                prompt="Can you describe what you're seeing? A short sentence is enough.",
            )
        )

    if not ticket.location.has_any_field():
        prompts.append(
            FollowUpPrompt(
                field="location",
                prompt=(
                    "Where is the issue? A nearby intersection, address, or "
                    "postal area is enough."
                ),
            )
        )

    return prompts


def validate_and_run(
    ticket: TicketIntake,
) -> Accepted | NeedsMoreInfo:
    missing = _check_missing(ticket)
    if missing:
        return NeedsMoreInfo(
            missing_fields=[p.field for p in missing],
            follow_up_prompts=missing,
        )

    # Pipeline stub. Replace with: validate → normalize location → embed →
    # category inference → historical retrieval → active duplicate → urgency.
    return _run_pipeline_stub(ticket)


def _run_pipeline_stub(ticket: TicketIntake) -> Accepted:
    ticket_id = f"ticket-{uuid4().hex[:12]}"
    canonical = {
        "ticket_id": ticket_id,
        "source": ticket.source,
        "description": ticket.description,
        "location": ticket.location.model_dump(),
        "observed_at": ticket.observed_at.isoformat() if ticket.observed_at else None,
        "reported_at": datetime.now(timezone.utc).isoformat(),
        "safety_answers": ticket.safety_answers.model_dump(),
        "hazard_flags": {
            k: (True if v == "yes" else False if v == "no" else None)
            for k, v in ticket.safety_answers.model_dump().items()
        },
        "media_refs": ticket.media_refs,
    }
    return Accepted(
        ticket_id=ticket_id,
        canonical_ticket=canonical,
        evidence_pack={
            "category_candidates": [],
            "nearest_historical_records": [],
            "active_duplicate_candidates": [],
            "duplicate_decision": "NOT_DUPLICATE",
            "urgency_decision": "LOW_URGENCY_SCHEDULING",
            "route": "SCHEDULING_AGENT",
            "note": "pipeline stub — real DGX path not yet wired",
        },
    )
