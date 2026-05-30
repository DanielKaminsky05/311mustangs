"""Shared FastAPI dependencies for the WhatsApp routers."""

from typing import Annotated

from fastapi import Depends, Request

from app.config import Settings, get_settings
from app.whatsapp.conversation_state import ConversationStore

SettingsDep = Annotated[Settings, Depends(get_settings)]


def get_conversation_store(request: Request) -> ConversationStore:
    # Created once in the app lifespan (see app.main) and shared.
    return request.app.state.conversations


ConversationStoreDep = Annotated[ConversationStore, Depends(get_conversation_store)]
