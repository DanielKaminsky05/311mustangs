"""Tests for the structured-ticket webhook contract.

Covers: HMAC auth, missing fields → NEEDS_MORE_INFO, complete payload →
ACCEPTED, backend-owned field rejection, idempotency by event_id.

The edge router has its own integration shape (form-encoded, Twilio
signature) covered in test_whatsapp_edge.py.
"""

import json

import pytest

from app.config import Settings, get_settings
from app.main import create_app
from app.whatsapp.hmac_auth import sign_body

INTAKE_SECRET = "test-secret-not-real"
HASHED_SENDER = "sha256:" + "a" * 64


def _override_settings():
    return Settings(intake_agent_secret=INTAKE_SECRET)


def _complete_payload(event_id: str = "evt-1") -> dict:
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
        "ticket": {
            "source": "whatsapp",
            "description": "Graffiti on a stop sign near Wychwood and Tyrrel.",
            "location": {
                "raw_text": "Wychwood Ave and Tyrrel Ave",
                "intersection_street_1": "Wychwood Ave",
                "intersection_street_2": "Tyrrel Ave",
                "postal_code_or_fsa": "M6G",
                "ward": None,
                "latitude": None,
                "longitude": None,
            },
            "observed_at": "2026-05-30T20:00:00",
            "safety_answers": {
                "injury": "no",
                "active_danger": "no",
                "blocking_road": "no",
                "blocking_sidewalk": "no",
                "flooding": "no",
                "sewage_or_water_issue": "no",
                "traffic_signal_issue": "no",
            },
            "media_refs": [],
        },
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
    body, headers = _post(_complete_payload())
    resp = await client.post(URL, content=body, headers=headers)
    assert resp.status_code == 201
    out = resp.json()
    assert out["status"] == "ACCEPTED"
    assert out["ticket_id"].startswith("ticket-")
    assert out["canonical_ticket"]["hazard_flags"]["injury"] is False


async def test_missing_location_returns_needs_more_info(client):
    payload = _complete_payload()
    payload["ticket"]["location"] = {
        "raw_text": None,
        "intersection_street_1": None,
        "intersection_street_2": None,
        "postal_code_or_fsa": None,
        "ward": None,
        "latitude": None,
        "longitude": None,
    }
    body, headers = _post(payload)
    resp = await client.post(URL, content=body, headers=headers)
    assert resp.status_code == 200
    out = resp.json()
    assert out["status"] == "NEEDS_MORE_INFO"
    assert "location" in out["missing_fields"]
    assert out["follow_up_prompts"][0]["field"] == "location"


async def test_unknown_safety_answer_is_preserved(client):
    payload = _complete_payload(event_id="evt-unk")
    payload["ticket"]["safety_answers"]["injury"] = "unknown"
    body, headers = _post(payload)
    resp = await client.post(URL, content=body, headers=headers)
    assert resp.status_code == 201
    flags = resp.json()["canonical_ticket"]["hazard_flags"]
    # `unknown` MUST NOT coerce to False — the contract requires tri-state.
    assert flags["injury"] is None


async def test_missing_signature_rejected(client):
    body = json.dumps(_complete_payload()).encode()
    resp = await client.post(
        URL, content=body, headers={"Content-Type": "application/json"}
    )
    assert resp.status_code == 401


async def test_bad_signature_rejected(client):
    body, _ = _post(_complete_payload())
    resp = await client.post(
        URL,
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Intake-Signature": "sha256=deadbeef",
        },
    )
    assert resp.status_code == 401


async def test_backend_owned_field_rejected(client):
    payload = _complete_payload(event_id="evt-leak")
    payload["ticket"]["urgency_score"] = 0.9
    body, headers = _post(payload)
    resp = await client.post(URL, content=body, headers=headers)
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert detail["error"] == "backend_owned_field_in_ticket"
    assert "urgency_score" in detail["fields"]


async def test_idempotent_same_event_id(client):
    payload = _complete_payload(event_id="evt-idem")
    body, headers = _post(payload)

    first = await client.post(URL, content=body, headers=headers)
    second = await client.post(URL, content=body, headers=headers)

    assert first.status_code == second.status_code == 201
    assert first.json()["ticket_id"] == second.json()["ticket_id"]


async def test_raw_phone_in_sender_hash_rejected(client):
    payload = _complete_payload(event_id="evt-rawphone")
    payload["channel"]["sender_id_hash"] = "whatsapp:+14155551234"
    body, headers = _post(payload)
    resp = await client.post(URL, content=body, headers=headers)
    assert resp.status_code == 422
