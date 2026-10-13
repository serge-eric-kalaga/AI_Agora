"""Vues globales sans secret de compte ou fournisseur."""

from datetime import datetime
from uuid import UUID

from api.schemas.common import APIModel


class AdminUserRead(APIModel):
    id: UUID
    username: str
    email: str
    is_active: bool
    is_superadmin: bool
    created_at: datetime


class AdminRoomRead(APIModel):
    id: UUID
    workspace_id: UUID
    workspace_name: str
    name: str
    topic: str
    status: str
    message_count: int
    created_at: datetime
