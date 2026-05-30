"""Structured ticket webhook (the contract endpoint).

The OpenClaw intake agent calls this when it believes it has enough facts.
Authentication is HMAC over the raw body (NOT Twilio's signature — Twilio
talks to the edge, not to this endpoint).

Idempotency: repeated deliveries of the same `event_id` return the same body.
"""

import json

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import ValidationError

from app.whatsapp.deps import ConversationStoreDep, SettingsDep
from app.whatsapp.hmac_auth import verify_signature
from app.whatsapp.intake_validator import validate_and_run
from app.whatsapp.schemas import (
    BACKEND_OWNED_FIELDS,
    Accepted,
    TicketSubmissionEnvelope,
)

router = APIRouter(
    prefix="/api/v1/webhooks/whatsapp", tags=["whatsapp-intake"]
)


@router.post(
    "/ticket-submissions",
    # 201 on accept, 200 on NEEDS_MORE_INFO — set explicitly per response below.
)
async def ticket_submissions(
    request: Request,
    settings: SettingsDep,
    conversations: ConversationStoreDep,
):
    raw = await request.body()

    # 1. HMAC auth. Constant-time comparison inside verify_signature.
    if not verify_signature(
        settings.intake_agent_secret,
        raw,
        request.headers.get("X-Intake-Signature"),
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "bad intake signature")

    # 2. Parse JSON envelope. 400 on malformed JSON; Pydantic returns 422 on
    #    invalid types (including backend-owned fields because TicketIntake has
    #    extra="forbid").
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"malformed JSON: {e}"
        ) from e

    # 3. Surface a clean error when the agent sent a backend-owned field.
    #    `extra="forbid"` will already trip — but the default Pydantic message
    #    doesn't say *why*. Pre-check so the agent gets a useful follow-up.
    raw_ticket = payload.get("ticket") if isinstance(payload, dict) else None
    if isinstance(raw_ticket, dict):
        leaked = sorted(BACKEND_OWNED_FIELDS & raw_ticket.keys())
        if leaked:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                {
                    "error": "backend_owned_field_in_ticket",
                    "fields": leaked,
                    "hint": (
                        "The agent submits FACTS only. The backend owns "
                        f"{sorted(BACKEND_OWNED_FIELDS)}."
                    ),
                },
            )

    try:
        envelope = TicketSubmissionEnvelope.model_validate(payload)
    except ValidationError as e:
        # include_url=False/include_context=False keeps the detail JSON-clean
        # (otherwise Pydantic ships a raw ValueError instance in ctx).
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            e.errors(include_url=False, include_context=False),
        ) from e

    # 4. Idempotency. Same event_id ⇒ same response body, same status code.
    cached = conversations.lookup_event(envelope.event_id)
    if cached is not None:
        return Response(
            content=json.dumps(cached["body"]),
            status_code=cached["status_code"],
            media_type="application/json",
        )

    # 5. Validate + run the (stubbed) pipeline.
    result = validate_and_run(envelope.ticket)
    status_code = (
        status.HTTP_201_CREATED if isinstance(result, Accepted) else status.HTTP_200_OK
    )
    body = result.model_dump()

    conversations.remember_event(
        envelope.event_id, {"status_code": status_code, "body": body}
    )

    return Response(
        content=json.dumps(body),
        status_code=status_code,
        media_type="application/json",
    )
