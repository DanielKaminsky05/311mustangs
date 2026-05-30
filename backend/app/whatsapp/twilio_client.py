"""Outbound WhatsApp send — POSTs to Twilio REST, Twilio relays to WhatsApp.

We do NOT use the Twilio CLI; that is a manual dev tool. Production replies go
through `client.messages.create()` (HTTP POST to api.twilio.com).
"""

from twilio.rest import Client

from app.config import Settings


def send_whatsapp(settings: Settings, *, to: str, body: str) -> str:
    """Send a free-form WhatsApp message. Returns the Twilio MessageSid.

    `to` and `from_` must both be `whatsapp:+E.164`. Caller is responsible for
    staying inside the 24-hour free-form window; outside it, an approved
    template is required.
    """
    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    msg = client.messages.create(
        from_=settings.twilio_whatsapp_from,
        to=to,
        body=body,
    )
    return msg.sid


async def download_media(settings: Settings, url: str) -> bytes:
    """Download a Twilio-hosted media URL with basic auth.

    Twilio media URLs require the account SID + auth token. We return raw bytes;
    the caller stores them and mints a server-known media_ref.
    """
    import httpx

    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            url, auth=(settings.twilio_account_sid, settings.twilio_auth_token)
        )
        r.raise_for_status()
        return r.content
