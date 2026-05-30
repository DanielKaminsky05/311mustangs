"""Outbound-reply endpoint.

The OpenClaw agent in the sandbox can't call Twilio (A1). When it wants to
ask a follow-up question or confirm a ticket, it POSTs the text here and
the host-side edge forwards it via the Twilio REST client.

Body is HMAC-signed with the same `INTAKE_AGENT_SECRET` as the structured
ticket webhook.
"""

import json

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field, ValidationError

from app.whatsapp.deps import SettingsDep
from app.whatsapp.hmac_auth import verify_signature
from app.whatsapp.twilio_client import send_whatsapp

router = APIRouter(prefix="/api/v1/intake", tags=["intake-replies"])


class ReplyRequest(BaseModel):
    # `to` is `whatsapp:+E.164`. The agent learns it from the original inbound
    # message; we keep it on the wire so the edge stays stateless w.r.t. the
    # sender→phone mapping.
    to: str = Field(min_length=1)
    body: str = Field(min_length=1, max_length=1500)


@router.post("/replies/{conversation_id}")
async def post_reply(
    conversation_id: str,
    request: Request,
    settings: SettingsDep,
):
    raw = await request.body()
    if not verify_signature(
        settings.intake_agent_secret,
        raw,
        request.headers.get("X-Intake-Signature"),
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "bad intake signature")

    try:
        payload = ReplyRequest.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValidationError) as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    if not settings.twilio_account_sid:
        # Dev convenience: returning 200 without actually sending lets the
        # agent be tested before Twilio creds are wired.
        return {"status": "skipped_no_twilio_creds"}

    sid = send_whatsapp(settings, to=payload.to, body=payload.body)
    return {"status": "sent", "message_sid": sid, "conversation_id": conversation_id}
