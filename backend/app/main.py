from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.users import UserStore, router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: build shared resources. A real DB connection pool would open here.
    app.state.users = UserStore()
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
    return app


app = create_app()
