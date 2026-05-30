"""Per-conversation fact state.

This is the only place the agent accumulates intake facts. `unknown` for a
safety answer is a valid value and MUST NOT be coerced to `no` — that would
break the contract in whatsapp-api.md.
"""

from dataclasses import dataclass, field
from typing import Literal

SafetyAnswer = Literal["yes", "no", "unknown"]
SAFETY_KEYS = (
    "injury",
    "active_danger",
    "blocking_road",
    "blocking_sidewalk",
    "flooding",
    "sewage_or_water_issue",
    "traffic_signal_issue",
)


@dataclass
class LocationFacts:
    raw_text: str | None = None
    intersection_street_1: str | None = None
    intersection_street_2: str | None = None
    postal_code_or_fsa: str | None = None
    ward: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    def is_useful(self) -> bool:
        return any(
            v not in (None, "")
            for v in (
                self.raw_text,
                self.intersection_street_1,
                self.intersection_street_2,
                self.postal_code_or_fsa,
                self.ward,
                self.latitude,
                self.longitude,
            )
        )


@dataclass
class ConversationFacts:
    sender_id_hash: str
    twilio_from: str = ""           # we need this to send replies back via the edge
    description: str = ""
    location: LocationFacts = field(default_factory=LocationFacts)
    observed_at: str | None = None  # ISO-8601 if the user gave one
    safety_answers: dict[str, SafetyAnswer] = field(
        default_factory=lambda: {k: "unknown" for k in SAFETY_KEYS}
    )
    media_refs: list[str] = field(default_factory=list)
    follow_ups_sent: int = 0
    submitted_ticket_id: str | None = None

    def to_intake_ticket(self) -> dict:
        """Shape that maps cleanly onto the backend TicketIntake schema."""
        return {
            "source": "whatsapp",
            "description": self.description,
            "location": {
                "raw_text": self.location.raw_text,
                "intersection_street_1": self.location.intersection_street_1,
                "intersection_street_2": self.location.intersection_street_2,
                "postal_code_or_fsa": self.location.postal_code_or_fsa,
                "ward": self.location.ward,
                "latitude": self.location.latitude,
                "longitude": self.location.longitude,
            },
            "observed_at": self.observed_at,
            "safety_answers": dict(self.safety_answers),
            "media_refs": list(self.media_refs),
        }


class ConversationStore:
    def __init__(self) -> None:
        self._convos: dict[str, ConversationFacts] = {}

    def get(self, sender_id_hash: str) -> ConversationFacts:
        c = self._convos.get(sender_id_hash)
        if c is None:
            c = ConversationFacts(sender_id_hash=sender_id_hash)
            self._convos[sender_id_hash] = c
        return c

    def reset(self, sender_id_hash: str) -> None:
        self._convos.pop(sender_id_hash, None)
