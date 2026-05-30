"""Sender-id hashing — salted sha256 of Twilio's `From` field.

We never store raw phone numbers. The hash is the conversation key on the edge
and the `sender_id_hash` on the structured ticket webhook. Rotating
`SENDER_HASH_SALT` invalidates every stored conversation, which is the desired
operator escape hatch.
"""

import hashlib


def hash_sender(twilio_from: str, salt: str) -> str:
    """Return `sha256:<hex>` for a Twilio `From` value, salted."""
    digest = hashlib.sha256(f"{salt}|{twilio_from}".encode()).hexdigest()
    return f"sha256:{digest}"
