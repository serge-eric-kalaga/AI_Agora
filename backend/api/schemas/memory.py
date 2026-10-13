"""Mémoire attribuée et synthèses traçables d'une conversation."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from .common import APIModel


class MemoryEntry(APIModel):
    kind: Literal["position", "question", "engagement", "accord", "desaccord"]
    text: str = Field(
        min_length=1, max_length=500, description="Élément synthétique attribué, sans fait inventé."
    )
    message_ids: list[UUID] = Field(
        min_length=1, max_length=4, description="Messages de la salle qui justifient cet élément."
    )
    author_agent_ids: list[UUID] = Field(
        default_factory=list,
        max_length=8,
        description="Agents auteurs des messages référencés ; vide pour un élément humain.",
    )


class MemoryState(APIModel):
    entries: list[MemoryEntry] = Field(default_factory=list, max_length=24)


class MemoryRead(MemoryState):
    updated_at: datetime | None = None
    through_message_id: UUID | None = None
    revision: int = 0
