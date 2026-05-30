"""Pydantic models for the WhatsApp/NemoClaw intake contract.

Authoritative spec: docs/planning/whatsapp-api.md
The agent submits FACTS only; backend owns ticket_id, reported_at, hazard_flags,
category, urgency, duplicate, and routing.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

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

# Backend-owned fields. If a NemoClaw caller includes any of these inside
# `ticket`, the request must be rejected — the agent does not classify.
BACKEND_OWNED_FIELDS = frozenset(
    {
        "ticket_id",
        "reported_at",
        "hazard_flags",
        "category_candidates",
        "urgency_score",
        "duplicate_decision",
        "route",
    }
)


class Location(BaseModel):
    model_config = ConfigDict(extra="forbid")

    raw_text: str | None = None
    intersection_street_1: str | None = None
    intersection_street_2: str | None = None
    postal_code_or_fsa: str | None = None
    ward: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    def has_any_field(self) -> bool:
        return any(
            v is not None and v != ""
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


class SafetyAnswers(BaseModel):
    model_config = ConfigDict(extra="forbid")

    injury: SafetyAnswer
    active_danger: SafetyAnswer
    blocking_road: SafetyAnswer
    blocking_sidewalk: SafetyAnswer
    flooding: SafetyAnswer
    sewage_or_water_issue: SafetyAnswer
    traffic_signal_issue: SafetyAnswer


class TicketIntake(BaseModel):
    """The intake facts submitted by the OpenClaw agent.

    `extra="forbid"` makes the schema reject any unknown field — including the
    backend-owned ones — at parse time.
    """

    model_config = ConfigDict(extra="forbid")

    source: Literal["whatsapp"]
    description: str = Field(min_length=1)
    location: Location
    observed_at: datetime | None = None
    safety_answers: SafetyAnswers
    media_refs: list[str] = Field(default_factory=list)


class Channel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: Literal["whatsapp"]
    conversation_id: str
    sender_id_hash: str
    message_ids: list[str] = Field(default_factory=list)

    @field_validator("sender_id_hash")
    @classmethod
    def must_be_hashed(cls, v: str) -> str:
        # Belt-and-braces: never store a raw phone. Twilio `From` looks like
        # "whatsapp:+14155551234"; a hashed value must not.
        if "+" in v or v.startswith("whatsapp:"):
            raise ValueError("sender_id_hash must be hashed, not a raw phone")
        return v


class TicketSubmissionEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_id: str = Field(min_length=1)
    event_type: Literal["ticket.submitted"]
    event_version: str
    sent_at: datetime
    channel: Channel
    ticket: TicketIntake


class FollowUpPrompt(BaseModel):
    field: str
    prompt: str


class NeedsMoreInfo(BaseModel):
    status: Literal["NEEDS_MORE_INFO"] = "NEEDS_MORE_INFO"
    missing_fields: list[str]
    follow_up_prompts: list[FollowUpPrompt]


class Accepted(BaseModel):
    status: Literal["ACCEPTED"] = "ACCEPTED"
    ticket_id: str
    canonical_ticket: dict
    evidence_pack: dict
