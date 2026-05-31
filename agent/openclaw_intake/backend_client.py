"""HMAC-signed HTTP client for the backend webhook endpoints.

Mirrors `backend/app/whatsapp/hmac_auth.py` — same algorithm, same header
name. Whatever changes there must change here.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone

import httpx

from state import ConversationFacts


def _sign(secret: str, body: bytes) -> str:
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


async def submit_ticket(
    *,
    backend_url: str,
    intake_secret: str,
    conversation_id: str,
    sender_id_hash: str,
    message_ids: list[str],
    facts: ConversationFacts,
) -> tuple[int, dict]:
    """POST the structured ticket. Returns (status_code, body)."""
    payload = {
        "event_id": f"wa-{uuid.uuid4().hex}",
        "event_type": "ticket.submitted",
        "event_version": "2026-05-30",
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "channel": {
            "provider": "whatsapp",
            "conversation_id": conversation_id,
            "sender_id_hash": sender_id_hash,
            "message_ids": message_ids,
        },
        "ticket_text": facts.to_ticket_text_v1(),
    }
    body = json.dumps(payload).encode()
    headers = {
        "Content-Type": "application/json",
        "X-Intake-Signature": _sign(intake_secret, body),
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{backend_url}/api/v1/webhooks/whatsapp/ticket-submissions",
            content=body,
            headers=headers,
        )
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, {"raw": r.text}


async def send_reply(
    *,
    backend_url: str,
    intake_secret: str,
    conversation_id: str,
    to: str,
    text: str,
) -> tuple[int, dict]:
    """POST a follow-up reply for the backend to relay via Twilio."""
    body = json.dumps({"to": to, "body": text}).encode()
    headers = {
        "Content-Type": "application/json",
        "X-Intake-Signature": _sign(intake_secret, body),
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            f"{backend_url}/api/v1/intake/replies/{conversation_id}",
            content=body,
            headers=headers,
        )
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, {"raw": r.text}
