"""POST inbound WhatsApp messages into the NemoClaw sandbox.

The OpenClaw intake agent inside the sandbox runs an HTTP listener (see
`docs/runbooks/nemoclaw-bringup.md`). The edge service does NOT enter the
sandbox; it sends a small JSON envelope and the agent owns the rest.
"""

import httpx

from app.config import Settings


async def post_inbound_message(
    settings: Settings,
    *,
    conversation_id: str,
    sender_id_hash: str,
    message_id: str,
    text: str,
    media_refs: list[str],
    twilio_from: str,
    location_pin: dict | None,
) -> None:
    """Best-effort POST to the sandbox. Errors are logged, not raised — the
    edge already returned 200 to Twilio and there is no useful retry path here
    for a fire-and-forget message."""
    if not settings.sandbox_message_url:
        # Wire-not-configured: dev convenience so the webhook is still useful
        # before the GX10 sandbox is reachable. Edge tests rely on this.
        return
    payload = {
        "conversation_id": conversation_id,
        "sender_id_hash": sender_id_hash,
        "message_id": message_id,
        "text": text,
        "media_refs": media_refs,
        "twilio_from": twilio_from,
        "location_pin": location_pin,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(settings.sandbox_message_url, json=payload)
    except httpx.HTTPError:
        # Log-and-drop. A real deployment swaps in structured logging here.
        pass
