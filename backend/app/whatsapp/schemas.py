"""Pydantic models for WhatsApp intake."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Channel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: Literal["whatsapp"]
    conversation_id: str
    sender_id_hash: str
    message_ids: list[str] = Field(default_factory=list)

    @field_validator("sender_id_hash")
    @classmethod
    def must_be_hashed(cls, v: str) -> str:
        if "+" in v or v.startswith("whatsapp:"):
            raise ValueError("sender_id_hash must be hashed, not a raw phone")
        return v


class TicketTextSubmissionEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_id: str = Field(min_length=1)
    event_type: Literal["ticket.submitted"]
    event_version: str
    sent_at: datetime
    channel: Channel
    ticket_text: str = Field(min_length=1)


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
