# Best Practices: FastAPI server

Conventions for any Python API server we stand up alongside this app. For the Next.js frontend, see **[nextjs-best-practices.md](nextjs-best-practices.md)**.

Targets **FastAPI + Pydantic v2 + async + Python 3.11+**.

### 1. Project layout

```
service/
├─ app/
│  ├─ main.py            # create_app(), lifespan, router includes
│  ├─ core/
│  │  ├─ config.py       # Settings (pydantic-settings)
│  │  └─ security.py     # auth helpers
│  ├─ api/
│  │  ├─ deps.py         # shared Depends() providers
│  │  └─ routes/         # one router module per resource
│  ├─ models/            # ORM models (SQLAlchemy)
│  ├─ schemas/           # Pydantic request/response models
│  ├─ services/          # business logic (no FastAPI imports here)
│  └─ db/                # session/engine setup
├─ tests/
├─ pyproject.toml
└─ .env (gitignored)
```

Keep **business logic in `services/`**, free of FastAPI types, so it's unit-testable and reusable.

### 2. App factory + lifespan (not `@app.on_event`)

`on_event` is deprecated. Use the `lifespan` context manager for startup/shutdown:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup: open pools, warm caches
    app.state.db = await create_pool()
    yield
    # shutdown: close cleanly
    await app.state.db.close()

def create_app() -> FastAPI:
    app = FastAPI(title="Service", lifespan=lifespan)
    from app.api.routes import items, users
    app.include_router(users.router, prefix="/users", tags=["users"])
    app.include_router(items.router, prefix="/items", tags=["items"])
    return app

app = create_app()
```

### 3. Settings via pydantic-settings

Never read `os.environ` ad hoc. Centralize and cache:

```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str
    secret_key: str
    cors_origins: list[str] = []

@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
```

Inject with `settings: Annotated[Settings, Depends(get_settings)]`.

### 4. Schemas (Pydantic v2)

- Separate **input** and **output** models; never return ORM objects directly.
- Use `model_config = ConfigDict(from_attributes=True)` to build response models from ORM rows.
- Use `response_model=` on routes so output is filtered/validated (don't leak `hashed_password`).

```python
from pydantic import BaseModel, ConfigDict, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
```

### 5. Routers, dependency injection, async

```python
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status

router = APIRouter()
DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]

@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, db: DbSession) -> User:
    if await users.exists(db, payload.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    return await users.create(db, payload)
```

- **Use `async def`** for routes that do I/O with async drivers. If a dependency or route must call a **blocking** library, make it a plain `def` so FastAPI runs it in a threadpool (don't block the event loop in an `async def`).
- Share resources (DB session, current user, settings) via `Depends`; alias with `Annotated` to keep signatures clean.
- Yield-based dependencies for cleanup:

  ```python
  async def get_db():
      async with SessionLocal() as session:
          yield session
  ```

### 6. Errors & validation

- Raise `HTTPException` with a precise status code for expected client errors.
- Let Pydantic handle request validation (returns 422 automatically). Add an exception handler for domain-specific exceptions to map them to responses centrally.
- Don't leak stack traces or internal messages to clients in production.

### 7. Security

- Hash passwords (`passlib`/`argon2`); store only hashes. Auth via OAuth2 + JWT (`fastapi.security.OAuth2PasswordBearer`).
- Lock down **CORS** explicitly via `CORSMiddleware` — no `["*"]` with credentials.
- Validate and bound all input; rely on Pydantic types and constraints (`Field(gt=0)`, `max_length`).
- Keep secrets in env/secret manager, never in code or VCS.

### 8. Performance & ops

- Use an **async DB driver** (asyncpg / SQLAlchemy 2.x async) and a connection pool opened in `lifespan`.
- Offload CPU-bound or long jobs to a task queue (e.g. Celery/RQ/`arq`), not request handlers; for fire-and-forget post-response work use `BackgroundTasks`.
- Add `/health` (liveness) and `/ready` (readiness) endpoints.
- Run with **uvicorn** (`uvicorn app.main:app`) behind multiple workers/gunicorn in prod; structured logging; OpenAPI docs at `/docs`.

### 9. Testing

- Use `httpx.AsyncClient` + `ASGITransport` (or `TestClient`) against `create_app()`.
- Override dependencies with `app.dependency_overrides` to inject test DBs/stubs.
- Test `services/` logic directly without the HTTP layer.

### Checklist

- [ ] `lifespan` (not `on_event`) for startup/shutdown; resources pooled.
- [ ] Settings via `pydantic-settings`, injected through `Depends`.
- [ ] Separate input/output schemas; routes set `response_model`.
- [ ] `async def` for async I/O; plain `def` for blocking calls.
- [ ] Auth, CORS, and input validation locked down; secrets in env.
- [ ] Health/readiness endpoints; tests override deps and hit the app factory.
