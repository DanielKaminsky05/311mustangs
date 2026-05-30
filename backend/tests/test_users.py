async def test_create_user_returns_safe_fields(client):
    resp = await client.post(
        "/users", json={"email": "a@example.com", "password": "supersecret"}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "a@example.com"
    assert "id" in body and "created_at" in body
    # Output model must not leak credentials.
    assert "password" not in body
    assert "hashed_password" not in body


async def test_get_user_roundtrip(client):
    created = (
        await client.post(
            "/users", json={"email": "b@example.com", "password": "supersecret"}
        )
    ).json()
    resp = await client.get(f"/users/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["email"] == "b@example.com"


async def test_duplicate_email_conflicts(client):
    payload = {"email": "dup@example.com", "password": "supersecret"}
    assert (await client.post("/users", json=payload)).status_code == 201
    resp = await client.post("/users", json=payload)
    assert resp.status_code == 409


async def test_get_missing_user_404(client):
    resp = await client.get("/users/999")
    assert resp.status_code == 404


async def test_short_password_rejected(client):
    resp = await client.post("/users", json={"email": "c@example.com", "password": "short"})
    assert resp.status_code == 422  # Pydantic validation


async def test_delete_user(client):
    created = (
        await client.post(
            "/users", json={"email": "d@example.com", "password": "supersecret"}
        )
    ).json()
    assert (await client.delete(f"/users/{created['id']}")).status_code == 204
    assert (await client.get(f"/users/{created['id']}")).status_code == 404
