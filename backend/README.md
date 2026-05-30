# 311mustangs API (FastAPI)

A basic FastAPI service scaffolded per [`../docs/fastapi-best-practices.md`](../docs/fastapi-best-practices.md).

## Layout

A deliberately flat layout for a small service — one module per concern:

```
app/
├─ main.py        # create_app(), lifespan, health/ready, router wiring
├─ config.py      # Settings (pydantic-settings)
├─ security.py    # password hashing (argon2)
├─ schemas.py     # Pydantic request/response models (UserCreate, UserOut)
└─ users.py       # users router + in-memory UserStore
tests/            # httpx.AsyncClient against the app factory
```

> The fuller, foldered layout in [`../docs/fastapi-best-practices.md`](../docs/fastapi-best-practices.md)
> (`api/`, `services/`, `models/`, `db/`) is what to grow into as the service
> gains resources and real persistence. For a basic service, flat modules are
> easier to read and navigate.

## Notes on the scaffold

- **Storage is in-memory** (`UserStore` in `app/users.py`) so it runs with no
  database. Swap it for a real repository (e.g. SQLAlchemy async) later — the
  routes won't change.
- **Auth is intentionally minimal** — passwords are hashed (argon2) and the
  output model never leaks the hash. JWT/OAuth2 login is left as the next step.

## Setup

```powershell
cd service
python -m venv .venv
.\.venv\Scripts\Activate.ps1        # PowerShell
pip install -e ".[dev]"
cp .env.example .env                 # optional; sane defaults exist
```

## Run

```powershell
uvicorn app.main:app --reload
```

- Docs (OpenAPI): http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/health · Readiness: http://127.0.0.1:8000/ready

## Test

```powershell
pytest
```
