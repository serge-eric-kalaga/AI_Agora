"""Contrats de configuration des agents IA."""

from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from .common import APIModel


class AgentCreate(APIModel):
    name: str = Field(min_length=2, max_length=80, examples=["Socrate"])
    role: str = Field(min_length=2, max_length=160, examples=["Analyste critique"])
    description: str = Field(default="", max_length=2_000)
    provider_id: UUID
    model: str = Field(min_length=1, max_length=160, examples=["gpt-4.1-mini"])
    color: str = Field(default="violet", min_length=2, max_length=30)
    system_prompt: str = Field(
        min_length=10,
        max_length=20_000,
        description="Instructions système versionnées de l'agent.",
    )
    traits: dict[str, int] = Field(
        default_factory=dict,
        description="Traits bornés de 0 à 100, par exemple créativité ou esprit critique.",
        examples=[{"creativite": 65, "espritCritique": 90}],
    )
    tools: list[str] = Field(default_factory=list)
    generation_config: dict[str, object] = Field(
        default_factory=dict,
        examples=[{"temperature": 0.4, "maxTokens": 1200}],
    )
    is_active: bool = True

    @field_validator("traits")
    @classmethod
    def validate_traits(cls, values: dict[str, int]) -> dict[str, int]:
        if any(value < 0 or value > 100 for value in values.values()):
            raise ValueError("Chaque trait doit être compris entre 0 et 100")
        return values


class AgentUpdate(APIModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    role: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2_000)
    provider_id: UUID | None = None
    model: str | None = Field(default=None, min_length=1, max_length=160)
    color: str | None = Field(default=None, min_length=2, max_length=30)
    system_prompt: str | None = Field(default=None, min_length=10, max_length=20_000)
    traits: dict[str, int] | None = None
    tools: list[str] | None = None
    generation_config: dict[str, object] | None = None
    is_active: bool | None = None
    expected_version: int = Field(ge=1, description="Version lue par le client.")

    @field_validator("traits")
    @classmethod
    def validate_optional_traits(cls, values: dict[str, int] | None) -> dict[str, int] | None:
        if values is not None and any(value < 0 or value > 100 for value in values.values()):
            raise ValueError("Chaque trait doit être compris entre 0 et 100")
        return values


class AgentRead(APIModel):
    id: UUID
    workspace_id: UUID
    provider_id: UUID
    name: str
    role: str
    description: str
    model: str
    color: str
    system_prompt: str
    traits: dict[str, int]
    tools: list[str]
    generation_config: dict[str, object]
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime
