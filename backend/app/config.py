from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings loaded from the environment / `.env` (not read ad hoc)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    project_name: str = "311mustangs-api"
    # JSON array in the env, e.g. CORS_ORIGINS='["http://localhost:3000"]'
    cors_origins: list[str] = []
    secret_key: str = "change-me"

    # Twilio WhatsApp (loaded from TWILIO_* env vars; blank until pasted into .env)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_from: str = ""  # e.g. "whatsapp:+14155238886"
    intake_agent_secret: str = ""  # only if the intake agent is a separate service


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
