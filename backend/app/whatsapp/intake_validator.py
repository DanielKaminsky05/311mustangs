"""Validation + pipeline stub for TICKET_TEXT_V1 payloads."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.whatsapp.schemas import Accepted, FollowUpPrompt, NeedsMoreInfo

REQUIRED_KEYS = ("DESCRIPTION", "INTERSECTION", "WARD")


def _parse_ticket_text(ticket_text: str) -> dict[str, str]:
    lines = [line.strip() for line in ticket_text.splitlines() if line.strip()]
    if not lines or lines[0] != "TICKET_TEXT_V1":
        return {}

    parsed: dict[str, str] = {}
    for line in lines[1:]:
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        parsed[key.strip().upper()] = value.strip()
    return parsed


def _missing_prompts(fields: dict[str, str]) -> list[FollowUpPrompt]:
    prompts: list[FollowUpPrompt] = []
    if not fields.get("DESCRIPTION"):
        prompts.append(
            FollowUpPrompt(
                field="DESCRIPTION",
                prompt="Can you briefly describe the issue you are reporting?",
            )
        )
    if not fields.get("INTERSECTION"):
        prompts.append(
            FollowUpPrompt(
                field="INTERSECTION",
                prompt="What intersection is this near? Format: street1 x street2.",
            )
        )
    if not fields.get("WARD"):
        prompts.append(
            FollowUpPrompt(
                field="WARD",
                prompt="If you know it, what ward is this in?",
            )
        )
    return prompts


def validate_and_run(ticket_text: str) -> Accepted | NeedsMoreInfo:
    parsed = _parse_ticket_text(ticket_text)
    if not parsed:
        return NeedsMoreInfo(
            missing_fields=["TICKET_TEXT_V1"],
            follow_up_prompts=[
                FollowUpPrompt(
                    field="TICKET_TEXT_V1",
                    prompt=(
                        "Please resend in this format:\n"
                        "TICKET_TEXT_V1\n"
                        "DESCRIPTION: ...\n"
                        "INTERSECTION: street1 x street2\n"
                        "WARD: ..."
                    ),
                )
            ],
        )

    missing = _missing_prompts(parsed)
    if missing:
        return NeedsMoreInfo(
            missing_fields=[p.field for p in missing],
            follow_up_prompts=missing,
        )

    return _run_pipeline_stub(ticket_text=ticket_text, fields=parsed)


def _run_pipeline_stub(*, ticket_text: str, fields: dict[str, str]) -> Accepted:
    ticket_id = f"ticket-{uuid4().hex[:12]}"
    canonical = {
        "ticket_id": ticket_id,
        "source": "whatsapp",
        "description": fields.get("DESCRIPTION", ""),
        "intersection": fields.get("INTERSECTION", ""),
        "ward": fields.get("WARD", ""),
        "reported_at": datetime.now(timezone.utc).isoformat(),
        "ticket_text": ticket_text,
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
