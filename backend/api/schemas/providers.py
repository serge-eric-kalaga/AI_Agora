"""Schemas des fournisseurs IA et des modeles declares."""

from datetime import datetime
from uuid import UUID

from pydantic import Field, HttpUrl, SecretStr, field_validator

from api.database.models import ProviderKind

from .common import APIModel


class ProviderCreate(APIModel):
    name: str = Field(min_length=2, max_length=100, examples=["OpenAI principal"])
    kind: ProviderKind = Field(description="Cloud, local ou serveur compatible OpenAI.")
    base_url: HttpUrl | None = Field(
        default=None,
        description="Endpoint optionnel. Les adresses privees seront controlees par le connecteur serveur.",
        examples=["https://api.openai.com/v1"],
    )
    api_key: SecretStr | None = Field(
        default=None,
        description="Secret chiffre avant persistance et jamais retourne par l'API.",
        examples=["sk-exemple-non-reel"],
    )
    models: list[str] = Field(default_factory=list, examples=[["gpt-4.1", "gpt-4.1-mini"]])
    capabilities: dict[str, object] = Field(
        default_factory=dict,
        examples=[{"streaming": True, "tools": True, "vision": False}],
    )
    is_enabled: bool = True

    @field_validator("models")
    @classmethod
    def unique_models(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(model.strip() for model in values if model.strip()))


class ProviderUpdate(APIModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    base_url: HttpUrl | None = None
    api_key: SecretStr | None = Field(
        default=None,
        description="Omettre pour conserver le secret. Une valeur non vide le remplace.",
    )
    models: list[str] | None = None
    capabilities: dict[str, object] | None = None
    is_enabled: bool | None = None


class ProviderRead(APIModel):
    id: UUID
    workspace_id: UUID
    name: str
    kind: ProviderKind
    base_url: str | None
    models: list[str]
    capabilities: dict[str, object]
    is_enabled: bool
    has_api_key: bool = Field(description="Indique si un secret chiffre est configure.")
    created_at: datetime
    updated_at: datetime


class ProviderTestResult(APIModel):
    reachable: bool
    message: str
    models_discovered: list[str] = Field(default_factory=list)
    tested_at: datetime
