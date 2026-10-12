"""Schemas transverses et conventions JSON de l'API."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class APIModel(BaseModel):
    """Base qui expose du camelCase tout en acceptant le snake_case Python."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        str_strip_whitespace=True,
    )


T = TypeVar("T")


class Page(APIModel, Generic[T]):
    """Page stable fondee sur un curseur opaque."""

    items: list[T]
    next_cursor: str | None = Field(
        default=None,
        description="Curseur a transmettre a la requete suivante, ou null en fin de liste.",
    )


class ErrorDetail(APIModel):
    code: str = Field(examples=["room_not_found"])
    message: str = Field(examples=["La salle demandee est introuvable."])
    request_id: str | None = None
    fields: dict[str, list[str]] | None = None


class ErrorResponse(APIModel):
    error: ErrorDetail


class HealthComponent(APIModel):
    status: str
    latency_ms: float | None = None


class HealthResponse(APIModel):
    status: str
    version: str
    components: dict[str, HealthComponent] | None = None
    checked_at: datetime


class AuditRead(APIModel):
    id: UUID
    action: str
    resource_type: str
    resource_id: str
    details: dict[str, object]
    created_at: datetime


SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
