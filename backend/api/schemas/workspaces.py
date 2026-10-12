"""Schemas des espaces collaboratifs."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field, field_validator

from api.database.models import WorkspaceRole

from .common import SLUG_PATTERN, APIModel


class WorkspaceCreate(APIModel):
    name: str = Field(min_length=2, max_length=120, examples=["Laboratoire Acme"])
    slug: str = Field(
        min_length=2,
        max_length=120,
        description="Identifiant lisible, unique et stable dans les URL.",
        examples=["laboratoire-acme"],
    )

    @field_validator("slug")
    @classmethod
    def valid_slug(cls, value: str) -> str:
        if not SLUG_PATTERN.fullmatch(value):
            raise ValueError("Utilisez uniquement des minuscules, chiffres et tirets")
        return value


class WorkspaceRead(APIModel):
    id: UUID
    name: str
    slug: str
    owner_id: UUID
    role: WorkspaceRole | None = None
    created_at: datetime


class AgentContributionRead(APIModel):
    agent_id: UUID
    message_count: int = Field(ge=0)


class AnalyticsEventRead(APIModel):
    id: UUID
    room_id: UUID
    room_name: str
    event_type: str
    actor_agent_id: UUID | None = None
    occurred_at: datetime


class WorkspaceAnalyticsRead(APIModel):
    """Mesures persistées calculées sur toutes les arènes d'un espace."""

    total_messages: int = Field(ge=0)
    human_messages: int = Field(ge=0)
    agent_messages: int = Field(ge=0)
    total_reactions: int = Field(ge=0)
    cloud_cost: Decimal = Field(ge=0)
    cloud_tokens: int = Field(ge=0)
    local_tokens: int = Field(ge=0)
    active_agents: int = Field(ge=0)
    contributions: list[AgentContributionRead]
    recent_events: list[AnalyticsEventRead]
