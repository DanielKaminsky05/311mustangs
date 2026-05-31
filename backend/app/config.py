from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings loaded from the environment / `.env` (not read ad hoc)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    project_name: str = "311mustangs-api"
    # JSON array in the env, e.g. CORS_ORIGINS='["http://localhost:3000"]'
    cors_origins: list[str] = []
    secret_key: str = "change-me"

    # Twilio (host-side edge — these creds never enter the NemoClaw sandbox)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_from: str = ""        # e.g. "whatsapp:+14155238886"
    twilio_validate_signature: bool = False  # off behind dev tunnels; on in prod

    # NemoClaw / OpenClaw intake agent
    intake_agent_secret: str = ""         # HMAC key for the structured ticket webhook
    sandbox_message_url: str = ""         # POST URL on the GX10 sandbox for inbound messages
    sender_hash_salt: str = "change-me-salt"  # salts the sha256 of Twilio's `From` field

    # Local vector stack (MVP): FastEmbed + Qdrant
    vector_enabled: bool = False
    qdrant_url: str = ""                # e.g. "http://localhost:6333"
    qdrant_api_key: str = ""
    qdrant_collection: str = "tickets_v1"
    embedding_model: str = "BAAI/bge-small-en-v1.5"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
