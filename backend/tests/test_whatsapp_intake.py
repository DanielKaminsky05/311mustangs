"""Tests for TICKET_TEXT_V1 structured-ticket webhook."""

import json

import pytest

from app.config import Settings, get_settings
from app.main import create_app
from app.whatsapp.hmac_auth import sign_body

INTAKE_SECRET = "test-secret-not-real"
HASHED_SENDER = "sha256:" + "a" * 64


def _override_settings():
    return Settings(intake_agent_secret=INTAKE_SECRET)


def _ticket_text(*, description: str = "Pothole near Bay and King", intersection: str = "Bay St x King St W", ward: str = "Ward 10") -> str:
    return (
        "TICKET_TEXT_V1\n"
        f"DESCRIPTION: {description}\n"
        f"INTERSECTION: {intersection}\n"
        f"WARD: {ward}"
    )


def _payload(event_id: str = "evt-1", ticket_text: str | None = None) -> dict:
    return {
        "event_id": event_id,
        "event_type": "ticket.submitted",
        "event_version": "2026-05-30",
        "sent_at": "2026-05-30T20:01:02Z",
        "channel": {
            "provider": "whatsapp",
            "conversation_id": "conv-abc",
            "sender_id_hash": HASHED_SENDER,
            "message_ids": ["wamid.123"],
        },
        "ticket_text": ticket_text or _ticket_text(),
    }


@pytest.fixture
async def client():
    from httpx import ASGITransport, AsyncClient

    app = create_app()
    app.dependency_overrides[get_settings] = _override_settings
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c


def _post(payload: dict, *, secret: str = INTAKE_SECRET) -> tuple[bytes, dict]:
    body = json.dumps(payload).encode()
    headers = {
        "Content-Type": "application/json",
        "X-Intake-Signature": sign_body(secret, body),
    }
    return body, headers


URL = "/api/v1/webhooks/whatsapp/ticket-submissions"


async def test_complete_payload_accepted(client):
    body, headers = _post(_payload())
    resp = await client.post(URL, content=body, headers=headers)
    assert resp.status_code == 201
    out = resp.json()
    assert out["status"] == "ACCEPTED"
    assert out["ticket_id"].startswith("ticket-")
    assert out["canonical_ticket"]["intersection"] == "Bay St x King St W"


async def test_missing_ward_returns_needs_more_info(client):
    body, headers = _post(_payload(ticket_text=_ticket_text(ward="")))
    resp = await client.post(URL, content=body, headers=headers)
    assert resp.status_code == 200
    out = resp.json()
    assert out["status"] == "NEEDS_MORE_INFO"
    assert "WARD" in out["missing_fields"]


async def test_invalid_prefix_returns_needs_more_info(client):
    p = _payload(ticket_text="DESCRIPTION: x")
    body, headers = _post(p)
    resp = await client.post(URL, content=body, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["missing_fields"] == ["TICKET_TEXT_V1"]


async def test_missing_signature_rejected(client):
    body = json.dumps(_payload()).encode()
    resp = await client.post(URL, content=body, headers={"Content-Type": "application/json"})
    assert resp.status_code == 401


async def test_idempotent_same_event_id(client):
    body, headers = _post(_payload(event_id="evt-idem"))
    first = await client.post(URL, content=body, headers=headers)
    second = await client.post(URL, content=body, headers=headers)
    assert first.status_code == second.status_code == 201
    assert first.json()["ticket_id"] == second.json()["ticket_id"]


async def test_raw_phone_in_sender_hash_rejected(client):
    p = _payload(event_id="evt-rawphone")
    p["channel"]["sender_id_hash"] = "whatsapp:+14155551234"
    body, headers = _post(p)
    resp = await client.post(URL, content=body, headers=headers)
    assert resp.status_code == 422
