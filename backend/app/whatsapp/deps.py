"""Shared FastAPI dependencies for the WhatsApp routers."""

from typing import Annotated

from fastapi import Depends, Request

from app.config import Settings, get_settings
from app.vector_store import LocalVectorStore
from app.whatsapp.conversation_state import ConversationStore

SettingsDep = Annotated[Settings, Depends(get_settings)]


def get_conversation_store(request: Request) -> ConversationStore:
    # Created once in the app lifespan (see app.main) and shared.
    return request.app.state.conversations


ConversationStoreDep = Annotated[ConversationStore, Depends(get_conversation_store)]


def get_vector_store(request: Request) -> LocalVectorStore | None:
    return request.app.state.vector_store


VectorStoreDep = Annotated[LocalVectorStore | None, Depends(get_vector_store)]
