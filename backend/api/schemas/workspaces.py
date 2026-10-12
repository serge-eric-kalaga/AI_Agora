"""Schemas des espaces collaboratifs."""

from datetime import datetime
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
