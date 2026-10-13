"""Contrats des collaborateurs et alertes personnelles."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import EmailStr, Field

from api.schemas.common import APIModel


class InvitationCreate(APIModel):
    email: EmailStr = Field(
        description="Adresse du compte autorisé à accepter ce lien. Aucun email n'est envoyé."
    )
    role: Literal["admin", "member", "observer"] = "member"


class RoleUpdate(APIModel):
    role: Literal["admin", "member", "observer"]


class InvitationAccept(APIModel):
    token: str = Field(
        min_length=40,
        max_length=128,
        description="Secret à usage unique fourni dans le lien d'invitation.",
    )


class InvitationRead(APIModel):
    id: UUID
    email: str
    role: str
    expires_at: datetime
    accepted_at: datetime | None
    revoked_at: datetime | None


class InvitationCreated(InvitationRead):
    token: str = Field(
        description="Secret restitué uniquement lors de la création. Il expire après sept jours."
    )


class MemberRead(APIModel):
    user_id: UUID
    username: str
    email: str | None = Field(
        description="Visible seulement aux administrateurs et au membre concerné."
    )
    role: str


class NotificationRead(APIModel):
    id: UUID
    kind: str
    room_id: UUID
    room_name: str
    message_id: UUID
    thread_root_id: UUID | None
    author_name: str
    excerpt: str
    created_at: datetime
    read_at: datetime | None
