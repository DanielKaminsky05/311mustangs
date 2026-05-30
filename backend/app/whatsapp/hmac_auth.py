"""HMAC body-signing for the structured ticket webhook.

The OpenClaw agent in the NemoClaw sandbox shares `INTAKE_AGENT_SECRET` with
the backend and signs every POST body. We verify in constant time.

Header convention:
    X-Intake-Signature: sha256=<hex digest of HMAC-SHA256(secret, raw_body)>
"""

import hashlib
import hmac


def sign_body(secret: str, body: bytes) -> str:
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def verify_signature(secret: str, body: bytes, header: str | None) -> bool:
    if not header or not secret:
        return False
    expected = sign_body(secret, body)
    return hmac.compare_digest(expected, header)
