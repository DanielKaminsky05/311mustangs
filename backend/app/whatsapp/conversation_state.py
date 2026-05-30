"""Per-sender conversation state for the edge.

MVP scope only — single-process in-memory dict keyed by `sender_id_hash`.
A6/A18 in `whatsapp-integration.md` flag this as insufficient for multi-
worker / restart scenarios; swap for SQLite when persistence matters.

The edge stores almost nothing — the agent in the sandbox owns the slot-filling
fact set. What lives here is: dedup of MessageSids, idempotency of structured
event_ids, and a counter we can use to cap the follow-up loop (A10).
"""

from dataclasses import dataclass, field


@dataclass
class ConversationState:
    seen_message_ids: set[str] = field(default_factory=set)
    follow_ups_sent: int = 0


class ConversationStore:
    def __init__(self) -> None:
        self._convos: dict[str, ConversationState] = {}
        self._event_ids: dict[str, dict] = {}  # event_id -> cached response body

    def get(self, sender_id_hash: str) -> ConversationState:
        state = self._convos.get(sender_id_hash)
        if state is None:
            state = ConversationState()
            self._convos[sender_id_hash] = state
        return state

    def already_seen_message(self, sender_id_hash: str, message_id: str) -> bool:
        state = self.get(sender_id_hash)
        if message_id in state.seen_message_ids:
            return True
        state.seen_message_ids.add(message_id)
        return False

    # Idempotency for the structured webhook (Twilio retries can fan out into
    # repeated agent submissions). Return cached body if event_id is a replay.
    def lookup_event(self, event_id: str) -> dict | None:
        return self._event_ids.get(event_id)

    def remember_event(self, event_id: str, body: dict) -> None:
        self._event_ids[event_id] = body
