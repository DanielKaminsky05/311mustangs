"""Inbound Twilio webhook signature verification.

Twilio signs requests with HMAC-SHA1 over `url + sorted(params)`. Behind a
local tunnel the scheme/host the app sees often differs from what Twilio
signed (Twilio CLI tunnel terminates TLS, ngrok rewrites Host) — so dev sets
TWILIO_VALIDATE_SIGNATURE=false. Always on in production.
"""

from twilio.request_validator import RequestValidator


def verify_twilio_signature(
    *,
    auth_token: str,
    url: str,
    params: dict[str, str],
    signature_header: str | None,
) -> bool:
    if not signature_header:
        return False
    validator = RequestValidator(auth_token)
    return validator.validate(url, params, signature_header)
