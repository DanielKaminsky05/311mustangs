from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings loaded from the environment / `.env` (not read ad hoc)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    project_name: str = "311mustangs-api"
    # JSON array in the env, e.g. CORS_ORIGINS='["http://localhost:3000"]'
    cors_origins: list[str] = []
    secret_key: str = "change-me"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
