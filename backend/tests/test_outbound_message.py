"""Manual smoke test for the outbound Twilio REST path.

This actually sends a WhatsApp message via the real Twilio API. Skipped by
pytest unless TEST_WHATSAPP_TO is set, so a default `pytest` run won't
spam messages. Two ways to run it:

  # one-shot, no pytest:
  $env:TEST_WHATSAPP_TO = "whatsapp:+1<your-e164-phone>"
  python tests\test_outbound_message.py

  # via pytest (-s shows the printed MessageSid):
  $env:TEST_WHATSAPP_TO = "whatsapp:+1<your-e164-phone>"
  pytest tests\test_outbound_message.py -s

The recipient phone must already be joined to the Twilio sandbox
(`join <two-word-code>` from twilio-setup.md step 1) and within the
24-hour free-form reply window.
"""

import os

import pytest

from app.config import Settings
from app.whatsapp.twilio_client import send_whatsapp

TO = os.environ.get("TEST_WHATSAPP_TO")

pytestmark = pytest.mark.skipif(
    not TO,
    reason="set TEST_WHATSAPP_TO=whatsapp:+1<your-e164-phone> to run the live smoke test",
)


def _send() -> str:
    settings = Settings()  # reads backend/.env via pydantic-settings
    assert settings.twilio_account_sid, "TWILIO_ACCOUNT_SID missing from .env"
    assert settings.twilio_auth_token, "TWILIO_AUTH_TOKEN missing from .env"
    assert settings.twilio_whatsapp_from, "TWILIO_WHATSAPP_FROM missing from .env"
    return send_whatsapp(
        settings,
        to=TO,
        body="Test from the 311mustangs backend (outbound REST path).",
    )


def test_send_real_whatsapp_message():
    sid = _send()
    print(f"\nSent. MessageSid={sid}")
    # Twilio MessageSids start with SM (SMS) or MM (multimedia/WhatsApp).
    assert sid.startswith(("SM", "MM")), f"unexpected SID shape: {sid}"


if __name__ == "__main__":
    if not TO:
        raise SystemExit(
            "Set TEST_WHATSAPP_TO first, e.g.:\n"
            '  $env:TEST_WHATSAPP_TO = "whatsapp:+14165550123"'
        )
    sid = _send()
    print(f"Sent. MessageSid={sid}")
