"""Routes des espaces de travail et de leur audit."""

from uuid import UUID

from fastapi import APIRouter, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from api.database.models import AuditLog, Workspace, WorkspaceMember, WorkspaceRole
from api.dependencies import CurrentUser, DbSession, require_workspace_member
from api.errors import ConflictError
from api.schemas.common import AuditRead, Page
from api.schemas.workspaces import WorkspaceCreate, WorkspaceRead
from api.services.audit import record_audit

router = APIRouter(prefix="/workspaces", tags=["Espaces de travail"])


def _read(workspace: Workspace, role: WorkspaceRole | None = None) -> WorkspaceRead:
    return WorkspaceRead(
        id=workspace.id,
        name=workspace.name,
        slug=workspace.slug,
        owner_id=workspace.owner_id,
        role=role,
        created_at=workspace.created_at,
    )


@router.get("", response_model=Page[WorkspaceRead], summary="Lister mes espaces de travail")
def list_workspaces(db: DbSession, current_user: CurrentUser) -> Page[WorkspaceRead]:
    rows = db.execute(
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == current_user.id)
        .order_by(Workspace.created_at)
    ).all()
    return Page(items=[_read(workspace, role) for workspace, role in rows])


@router.post(
    "",
    response_model=WorkspaceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un espace de travail",
)
def create_workspace(payload: WorkspaceCreate, db: DbSession, current_user: CurrentUser) -> WorkspaceRead:
    workspace = Workspace(name=payload.name, slug=payload.slug, owner_id=current_user.id)
    db.add(workspace)
    try:
        db.flush()
        db.add(WorkspaceMember(workspace_id=workspace.id, user_id=current_user.id, role=WorkspaceRole.OWNER))
        record_audit(
            db,
            action="workspace.created",
            resource_type="workspace",
            resource_id=workspace.id,
            actor_user_id=current_user.id,
            workspace_id=workspace.id,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("workspace_slug_taken", "Ce slug d'espace de travail est déjà utilisé.") from exc
    db.refresh(workspace)
    return _read(workspace, WorkspaceRole.OWNER)


@router.get("/{workspace_id}", response_model=WorkspaceRead, summary="Lire un espace de travail")
def get_workspace(workspace_id: UUID, db: DbSession, current_user: CurrentUser) -> WorkspaceRead:
    member = require_workspace_member(db, workspace_id, current_user)
    return _read(member.workspace, member.role)


@router.get(
    "/{workspace_id}/audit",
    response_model=Page[AuditRead],
    summary="Consulter le journal d'audit",
    description="Réservé aux membres. Les entrées sont triées de la plus récente à la plus ancienne.",
)
def list_audit(
    workspace_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=200),
) -> Page[AuditRead]:
    require_workspace_member(db, workspace_id, current_user)
    entries = db.scalars(
        select(AuditLog)
        .where(AuditLog.workspace_id == workspace_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    ).all()
    return Page(items=[AuditRead.model_validate(entry) for entry in entries])
