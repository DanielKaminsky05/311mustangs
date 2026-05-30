import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_app


@pytest.fixture
async def client():
    """An HTTP client bound to a fresh app instance per test.

    Building the app via the factory (not importing a global) gives each test
    an isolated in-memory store. `lifespan_context` runs startup/shutdown so
    `app.state.user_repository` is populated.
    """
    app = create_app()
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
