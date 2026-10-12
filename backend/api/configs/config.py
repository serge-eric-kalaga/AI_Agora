"""Configuration centralisee de l'API AI Agora."""

from functools import lru_cache
from typing import Literal

from cryptography.fernet import Fernet
from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Parametres valides au demarrage de l'application."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "AI Agora API"
    app_environment: Literal["development", "test", "production"] = "development"
    app_debug: bool = False
    api_v1_prefix: str = "/api/v1"
    frontend_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    database_url: str = "postgresql+psycopg://ai_agora:ai_agora@postgres:5432/ai_agora"
    redis_url: str = "redis://redis:6379/0"
    jwt_secret: SecretStr = SecretStr("change-this-development-secret-with-32-bytes")
    jwt_algorithm: Literal["HS256", "HS384", "HS512"] = "HS256"
    access_token_expire_minutes: int = 60
    credential_encryption_key: SecretStr | None = None
    docs_enabled: bool = True
    metrics_enabled: bool = True
    log_level: str = "INFO"
    sse_poll_interval_seconds: float = 0.75
    sse_heartbeat_seconds: float = 15.0
    autonomous_turn_delay_seconds: int = Field(default=4, ge=1, le=300)
    room_turn_lock_seconds: int = Field(default=180, ge=30, le=600)
    allow_private_provider_endpoints: bool = False

    @field_validator("frontend_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        """Accepte aussi une liste separee par des virgules dans Docker."""

        if isinstance(value, str) and not value.lstrip().startswith("["):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("credential_encryption_key", mode="before")
    @classmethod
    def empty_encryption_key(cls, value: object) -> object:
        """Traite une variable Docker vide comme une valeur absente."""

        return None if value == "" else value

    def validate_runtime(self) -> None:
        """Verifie les invariants qui dependent de plusieurs variables."""

        if self.app_environment == "production":
            jwt_secret = self.jwt_secret.get_secret_value()
            if len(jwt_secret.encode()) < 32 or jwt_secret.startswith(("change-", "replace-")):
                raise ValueError("JWT_SECRET doit contenir au moins 32 octets aléatoires en production")
            if not self.credential_encryption_key:
                raise ValueError("CREDENTIAL_ENCRYPTION_KEY est obligatoire en production")
            try:
                Fernet(self.credential_encryption_key.get_secret_value().encode())
            except (TypeError, ValueError) as exc:
                raise ValueError(
                    "CREDENTIAL_ENCRYPTION_KEY doit être une clé Fernet valide"
                ) from exc
            if "*" in self.frontend_origins:
                raise ValueError("Les origines CORS generiques sont interdites en production")
            if self.allow_private_provider_endpoints:
                raise ValueError(
                    "ALLOW_PRIVATE_PROVIDER_ENDPOINTS doit être désactivé en production"
                )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_runtime()
    return settings


Setting = get_settings()
