"""OpenClaw intake agent — FastAPI service inside the NemoClaw sandbox.

Listens on :9000 for inbound messages from the laptop edge. Calls
gemma4:26b via inference.local to extract facts and decide next step.
Submits structured tickets to the laptop backend over HMAC-signed HTTP.

Twilio creds NEVER live here (A1) — outbound replies go through the
backend's `/api/v1/intake/replies/{conversation_id}` endpoint.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel, Field

from backend_client import send_reply, submit_ticket
from extractor import extract_and_decide, merge_updated_facts
from state import ConversationStore

MAX_FOLLOW_UPS = 3


class Settings:
    """Plain object — pydantic-settings is overkill here. Env-only."""

    def __init__(self) -> None:
        self.backend_url = os.environ["INTAKE_BACKEND_URL"].rstrip("/")
        self.intake_secret = os.environ["INTAKE_AGENT_SECRET"]
        self.inference_base_url = os.environ.get(
            "INFERENCE_BASE_URL", "http://inference.local"
        ).rstrip("/")
        self.inference_model = os.environ.get("INFERENCE_MODEL", "gemma4:26b")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.settings = Settings()
    app.state.conversations = ConversationStore()
    yield


app = FastAPI(title="openclaw-intake-agent", lifespan=lifespan)


class InboundMessage(BaseModel):
    conversation_id: str
    sender_id_hash: str
    message_id: str
    text: str = ""
    media_refs: list[str] = Field(default_factory=list)
    # The edge needs this to relay our follow-ups back via Twilio. We keep it
    # in-memory only — never logged, never persisted.
    twilio_from: str = ""
    location_pin: dict | None = None


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/messages")
async def messages(msg: InboundMessage):
    s: Settings = app.state.settings
    store: ConversationStore = app.state.conversations
    facts = store.get(msg.sender_id_hash)

    if msg.twilio_from and not facts.twilio_from:
        facts.twilio_from = msg.twilio_from

    # Append media + a location pin if present. We do not embed media; the
    # backend stores them as evidence only (A8).
    if msg.media_refs:
        facts.media_refs.extend(m for m in msg.media_refs if m not in facts.media_refs)
    if msg.location_pin and msg.location_pin.get("latitude") is not None:
        facts.location.latitude = float(msg.location_pin["latitude"])
        facts.location.longitude = float(msg.location_pin["longitude"])

    # 1. Ask the model to update facts and decide.
    decision = await extract_and_decide(
        inference_base_url=s.inference_base_url,
        inference_model=s.inference_model,
        facts=facts,
        new_user_message=msg.text,
    )
    merge_updated_facts(facts, decision.get("updated_facts") or {})

    # 2. Force-submit if we've exhausted the follow-up budget (A10).
    if facts.follow_ups_sent >= MAX_FOLLOW_UPS:
        decision["next_action"] = "submit"

    # 3. Act.
    if decision.get("next_action") == "submit":
        return await _submit_and_confirm(msg, facts, s)

    # Otherwise ask a follow-up.
    follow_up = (decision.get("follow_up") or "").strip()
    if not follow_up:
        follow_up = "Can you tell me a bit more — what's happening and where?"
    facts.follow_ups_sent += 1
    if facts.twilio_from:
        await send_reply(
            backend_url=s.backend_url,
            intake_secret=s.intake_secret,
            conversation_id=msg.conversation_id,
            to=facts.twilio_from,
            text=follow_up,
        )
    return {"action": "ask", "follow_up": follow_up}


async def _submit_and_confirm(
    msg: InboundMessage, facts, s: Settings
) -> dict:
    status_code, body = await submit_ticket(
        backend_url=s.backend_url,
        intake_secret=s.intake_secret,
        conversation_id=msg.conversation_id,
        sender_id_hash=msg.sender_id_hash,
        message_ids=[msg.message_id],
        facts=facts,
    )

    # 200 NEEDS_MORE_INFO → ask the prompt the backend returned.
    if status_code == 200 and body.get("status") == "NEEDS_MORE_INFO":
        prompts = body.get("follow_up_prompts") or []
        text = prompts[0]["prompt"] if prompts else (
            "I need a bit more info — could you share the location or what's going on?"
        )
        facts.follow_ups_sent += 1
        if facts.twilio_from:
            await send_reply(
                backend_url=s.backend_url,
                intake_secret=s.intake_secret,
                conversation_id=msg.conversation_id,
                to=facts.twilio_from,
                text=text,
            )
        return {"action": "needs_more_info", "follow_up": text, "backend": body}

    # 201 ACCEPTED → confirm to user.
    if status_code == 201 and body.get("status") == "ACCEPTED":
        facts.submitted_ticket_id = body.get("ticket_id")
        confirmation = (
            "Thanks — your report was filed. "
            f"Reference: {facts.submitted_ticket_id}."
        )
        if facts.twilio_from:
            await send_reply(
                backend_url=s.backend_url,
                intake_secret=s.intake_secret,
                conversation_id=msg.conversation_id,
                to=facts.twilio_from,
                text=confirmation,
            )
        return {"action": "accepted", "ticket_id": facts.submitted_ticket_id}

    # Anything else (422/500/503): tell the user something generic; don't
    # leak the backend error. Real implementations should retry with backoff.
    if facts.twilio_from:
        await send_reply(
            backend_url=s.backend_url,
            intake_secret=s.intake_secret,
            conversation_id=msg.conversation_id,
            to=facts.twilio_from,
            text="I'm having trouble filing your report right now. Please try again in a minute.",
        )
    return {"action": "error", "status_code": status_code, "body": body}
