"""Dépendances d'authentification et d'autorisation des routes."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.database import get_db
from api.database.models import User, WorkspaceMember, WorkspaceRole
from api.errors import DomainError, NotFoundError
from api.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")
DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: DbSession) -> User:
    user = db.get(User, decode_access_token(token))
    if not user or not user.is_active:
        raise DomainError("inactive_user", "Ce compte est introuvable ou désactivé.", 401)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_workspace_member(db: Session, workspace_id: UUID, user: User) -> WorkspaceMember:
    member = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.id,
        )
    )
    if not member:
        raise NotFoundError("workspace_not_found", "L'espace de travail est introuvable.")
    return member


def require_workspace_editor(db: Session, workspace_id: UUID, user: User) -> WorkspaceMember:
    member = require_workspace_member(db, workspace_id, user)
    if member.role not in {WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER}:
        raise DomainError(
            "workspace_read_only",
            "Votre rôle ne permet pas de modifier cet espace de travail.",
            403,
        )
    return member
