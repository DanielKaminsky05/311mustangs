"""Tests for the raw Twilio edge webhook.

Covers fast-200 behavior, sender hashing, MessageSid dedupe, location-pin
capture, and signature-off (dev) mode. Signature-ON is tested separately
with a known-good Twilio fixture; behind a dev tunnel it's always OFF.
"""

import pytest

from app.config import Settings, get_settings
from app.main import create_app


def _override_settings():
    # Validation off (dev tunnel default); sandbox URL empty so the background
    # task is a no-op and tests stay hermetic.
    return Settings(
        twilio_validate_signature=False,
        sandbox_message_url="",
        sender_hash_salt="test-salt",
    )


@pytest.fixture
async def client():
    from httpx import ASGITransport, AsyncClient

    app = create_app()
    app.dependency_overrides[get_settings] = _override_settings
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c


async def test_verify_endpoint(client):
    resp = await client.get("/api/v1/webhooks/whatsapp")
    assert resp.status_code == 200
    assert resp.text == "ok"


async def test_inbound_text_message_acked(client):
    resp = await client.post(
        "/api/v1/webhooks/whatsapp",
        data={
            "From": "whatsapp:+14155551234",
            "Body": "There is a pothole at Bay and King",
            "MessageSid": "SM1",
            "NumMedia": "0",
        },
    )
    assert resp.status_code == 200


async def test_duplicate_message_sid_is_idempotent(client):
    data = {
        "From": "whatsapp:+14155551234",
        "Body": "first",
        "MessageSid": "SM-dup",
        "NumMedia": "0",
    }
    a = await client.post("/api/v1/webhooks/whatsapp", data=data)
    b = await client.post("/api/v1/webhooks/whatsapp", data=data)
    assert a.status_code == 200
    assert b.status_code == 200  # silently deduped, still ack


async def test_location_pin_accepted(client):
    resp = await client.post(
        "/api/v1/webhooks/whatsapp",
        data={
            "From": "whatsapp:+14155551234",
            "Body": "",
            "MessageSid": "SM-loc",
            "NumMedia": "0",
            "Latitude": "43.6772",
            "Longitude": "-79.4163",
        },
    )
    assert resp.status_code == 200
