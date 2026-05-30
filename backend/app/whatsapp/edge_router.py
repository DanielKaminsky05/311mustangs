"""Raw Twilio webhook (the host-side edge).

Twilio creds live here and never enter the NemoClaw sandbox (whatsapp-
integration.md A1). Responsibilities:

  - verify X-Twilio-Signature (off behind dev tunnels)
  - return 200 fast to avoid Twilio's ~15s timeout (A3)
  - hash the sender; never persist raw phone numbers (A14/A15)
  - dedupe by MessageSid (A4)
  - capture a location-pin's lat/long when present (A6)
  - forward the message into the sandbox (BackgroundTasks)
  - download media (basic auth) — TODO: store + mint media_refs
"""

from fastapi import APIRouter, BackgroundTasks, Form, HTTPException, Request, status
from fastapi.responses import PlainTextResponse, Response

from app.whatsapp.deps import ConversationStoreDep, SettingsDep
from app.whatsapp.sandbox_bridge import post_inbound_message
from app.whatsapp.sender_id import hash_sender
from app.whatsapp.twilio_signature import verify_twilio_signature

router = APIRouter(prefix="/api/v1/webhooks/whatsapp", tags=["whatsapp-edge"])


@router.get("", response_class=PlainTextResponse)
async def whatsapp_verify(request: Request):
    """Provider challenge/verification.

    The Twilio sandbox does not do a Meta-style hub.challenge handshake; this
    endpoint mostly serves as a health-check that the tunnel is wired. Real
    Meta WABA deployments would echo `hub.challenge` here.
    """
    challenge = request.query_params.get("hub.challenge")
    return challenge or "ok"


@router.post("", status_code=status.HTTP_200_OK)
async def whatsapp_inbound(
    request: Request,
    background: BackgroundTasks,
    settings: SettingsDep,
    conversations: ConversationStoreDep,
    # Twilio posts application/x-www-form-urlencoded — NOT JSON.
    From: str = Form(...),
    Body: str = Form(""),
    MessageSid: str = Form(...),
    NumMedia: int = Form(0),
    Latitude: float | None = Form(None),
    Longitude: float | None = Form(None),
):
    if settings.twilio_validate_signature:
        # Reconstruct the full signed URL exactly as Twilio saw it. Behind a
        # proxy you must honor X-Forwarded-* — but we deliberately ship dev with
        # validation OFF, since the Twilio CLI tunnel rewrites scheme/host.
        form = await request.form()
        params = {k: str(v) for k, v in form.items()}
        ok = verify_twilio_signature(
            auth_token=settings.twilio_auth_token,
            url=str(request.url),
            params=params,
            signature_header=request.headers.get("X-Twilio-Signature"),
        )
        if not ok:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "bad signature")

    sender_hash = hash_sender(From, settings.sender_hash_salt)

    # Dedupe Twilio retries. If we've already seen this MessageSid, ack and skip.
    if conversations.already_seen_message(sender_hash, MessageSid):
        return Response(status_code=status.HTTP_200_OK)

    # Media: collect Twilio URLs to download in the background. We don't store
    # raw bytes from inside the request handler — that would block the ack.
    media_urls: list[str] = []
    form = await request.form()
    for i in range(NumMedia):
        url = form.get(f"MediaUrl{i}")
        if url:
            media_urls.append(str(url))

    location_pin = (
        {"latitude": Latitude, "longitude": Longitude}
        if Latitude is not None and Longitude is not None
        else None
    )

    background.add_task(
        _forward_to_sandbox,
        settings=settings,
        conversation_id=sender_hash,
        sender_id_hash=sender_hash,
        message_id=MessageSid,
        text=Body,
        media_urls=media_urls,
        location_pin=location_pin,
    )

    # 200 fast — Twilio is happy, real work happens in the background task.
    return Response(status_code=status.HTTP_200_OK)


async def _forward_to_sandbox(
    *,
    settings,
    conversation_id: str,
    sender_id_hash: str,
    message_id: str,
    text: str,
    media_urls: list[str],
    location_pin: dict | None,
) -> None:
    # TODO: download media via twilio_client.download_media, persist, mint
    # server-known media_refs. For now we pass the Twilio URLs through and
    # leave that as a follow-up — the contract only requires server IDs at the
    # *structured* webhook layer.
    media_refs = media_urls

    await post_inbound_message(
        settings,
        conversation_id=conversation_id,
        sender_id_hash=sender_id_hash,
        message_id=message_id,
        text=text,
        media_refs=media_refs,
        location_pin=location_pin,
    )
