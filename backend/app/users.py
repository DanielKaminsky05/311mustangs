from dataclasses import dataclass
from datetime import datetime, timezone
from itertools import count
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.schemas import UserCreate, UserOut
from app.security import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@dataclass
class User:
    id: int
    email: str
    hashed_password: str
    created_at: datetime


class UserStore:
    """In-memory store so the scaffold runs with no database. Swap for a real
    repository (e.g. SQLAlchemy async) later; the routes won't need to change."""

    def __init__(self) -> None:
        self._users: dict[int, User] = {}
        self._ids = count(1)

    def list(self) -> list[User]:
        return list(self._users.values())

    def get(self, user_id: int) -> User | None:
        return self._users.get(user_id)

    def by_email(self, email: str) -> User | None:
        return next((u for u in self._users.values() if u.email == email), None)

    def add(self, email: str, hashed_password: str) -> User:
        user = User(next(self._ids), email, hashed_password, datetime.now(timezone.utc))
        self._users[user.id] = user
        return user

    def delete(self, user_id: int) -> bool:
        return self._users.pop(user_id, None) is not None


def get_store(request: Request) -> UserStore:
    # Created once in the app lifespan (see main.py) and shared across requests.
    return request.app.state.users


StoreDep = Annotated[UserStore, Depends(get_store)]


@router.get("", response_model=list[UserOut])
async def list_users(store: StoreDep):
    return store.list()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, store: StoreDep):
    if store.by_email(payload.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    return store.add(payload.email, hash_password(payload.password))


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: int, store: StoreDep):
    user = store.get(user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, store: StoreDep):
    if not store.delete(user_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
