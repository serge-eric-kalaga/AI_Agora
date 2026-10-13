"""Pièces jointes et instantanés de sources consultables dans une salle."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, HttpUrl

from .common import APIModel


class SourceCreate(APIModel):
    url: HttpUrl = Field(
        max_length=2000,
        description="Page publique HTTP(S), texte ou PDF. La destination et chaque redirection sont contrôlées ; le réseau privé est interdit.",
    )


class ResourceRead(APIModel):
    id: UUID
    room_id: UUID
    kind: Literal["document", "source"]
    title: str
    url: str | None
    filename: str | None
    excerpt: str
    created_at: datetime = Field(
        description="Date d'import ou de consultation de cet instantané, sans garantie de mise à jour automatique."
    )


class ResourceDetailRead(ResourceRead):
    content: str
