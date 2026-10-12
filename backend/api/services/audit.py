"""Écriture centralisée du journal d'audit fonctionnel."""

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from api.database.models import AuditLog


def record_audit(
    db: Session,
    *,
    action: str,
    resource_type: str,
    resource_id: UUID | str,
    actor_user_id: UUID | None,
    workspace_id: UUID | None,
    details: dict[str, Any] | None = None,
) -> AuditLog:
    entry = AuditLog(
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id),
        actor_user_id=actor_user_id,
        workspace_id=workspace_id,
        details=details or {},
    )
    db.add(entry)
    return entry
