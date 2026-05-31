from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.users import UserStore, router as users_router
from app.vector_store import LocalVectorConfig, LocalVectorStore
from app.whatsapp.conversation_state import ConversationStore
from app.whatsapp.edge_router import router as whatsapp_edge_router
from app.whatsapp.intake_router import router as whatsapp_intake_router
from app.whatsapp.replies_router import router as whatsapp_replies_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: build shared resources. A real DB connection pool would open here.
    app.state.users = UserStore()
    app.state.conversations = ConversationStore()
    settings = get_settings()
    app.state.vector_store = None
    if settings.vector_enabled and settings.qdrant_url:
        app.state.vector_store = LocalVectorStore(
            LocalVectorConfig(
                url=settings.qdrant_url,
                api_key=settings.qdrant_api_key,
                collection=settings.qdrant_collection,
                embedding_model=settings.embedding_model,
            )
        )
    yield
    # Shutdown: close pools / flush here. Nothing to release for in-memory.


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.project_name, lifespan=lifespan)

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.get("/health", tags=["health"])
    async def health():
        return {"status": "ok"}

    @app.get("/ready", tags=["health"])
    async def ready():
        return {"status": "ready"}

    app.include_router(users_router)
    app.include_router(whatsapp_edge_router)
    app.include_router(whatsapp_intake_router)
    app.include_router(whatsapp_replies_router)
    return app


app = create_app()
