"""Routes des espaces de travail et de leur audit."""

from uuid import UUID

from fastapi import APIRouter, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from api.database.models import (
    AgentDefinition,
    AuditLog,
    ConversationEvent,
    Message,
    MessageKind,
    MessageReaction,
    Room,
    Workspace,
    WorkspaceMember,
    WorkspaceRole,
)
from api.dependencies import CurrentUser, DbSession, require_workspace_member
from api.errors import ConflictError
from api.schemas.common import AuditRead, Page
from api.schemas.workspaces import (
    AgentContributionRead,
    AnalyticsEventRead,
    WorkspaceAnalyticsRead,
    WorkspaceCreate,
    WorkspaceRead,
)
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


@router.get(
    "",
    response_model=Page[WorkspaceRead],
    summary="Lister les espaces accessibles",
    description="Retourne les espaces du membre, ou tous les espaces pour un superadmin. Le privilège est vérifié en base à chaque requête.",
)
def list_workspaces(db: DbSession, current_user: CurrentUser) -> Page[WorkspaceRead]:
    if current_user.is_superadmin:
        # Le superadmin explore tous les espaces depuis les parcours habituels.
        workspaces = db.scalars(select(Workspace).order_by(Workspace.created_at)).all()
        return Page(items=[_read(workspace, WorkspaceRole.ADMIN) for workspace in workspaces])
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
def create_workspace(
    payload: WorkspaceCreate, db: DbSession, current_user: CurrentUser
) -> WorkspaceRead:
    workspace = Workspace(name=payload.name, slug=payload.slug, owner_id=current_user.id)
    db.add(workspace)
    try:
        db.flush()
        db.add(
            WorkspaceMember(
                workspace_id=workspace.id, user_id=current_user.id, role=WorkspaceRole.OWNER
            )
        )
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
        raise ConflictError(
            "workspace_slug_taken", "Ce slug d'espace de travail est déjà utilisé."
        ) from exc
    db.refresh(workspace)
    return _read(workspace, WorkspaceRole.OWNER)


@router.get("/{workspace_id}", response_model=WorkspaceRead, summary="Lire un espace de travail")
def get_workspace(workspace_id: UUID, db: DbSession, current_user: CurrentUser) -> WorkspaceRead:
    member = require_workspace_member(db, workspace_id, current_user)
    return _read(member.workspace, member.role)


@router.get(
    "/{workspace_id}/analytics",
    response_model=WorkspaceAnalyticsRead,
    summary="Mesurer l'activité d'un espace",
    description=(
        "Calcule les messages, contributions, réactions, coûts et jetons à partir des données "
        "persistées de toutes les arènes de l'espace. Les 30 événements les plus récents sont inclus."
    ),
)
def get_workspace_analytics(
    workspace_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> WorkspaceAnalyticsRead:
    require_workspace_member(db, workspace_id, current_user)
    total_messages, human_messages, agent_messages = db.execute(
        select(
            func.count(Message.id),
            func.count(Message.id).filter(Message.author_user_id.is_not(None)),
            func.count(Message.id).filter(Message.author_agent_id.is_not(None)),
        )
        .join(Room, Room.id == Message.room_id)
        .where(
            (current_user.is_superadmin or Room.workspace_id == workspace_id),
            Message.kind == MessageKind.MESSAGE,
        )
    ).one()
    cloud_cost, cloud_tokens, local_tokens = db.execute(
        select(
            func.coalesce(func.sum(Room.amount_spent), 0),
            func.coalesce(func.sum(Room.cloud_tokens), 0),
            func.coalesce(func.sum(Room.local_tokens), 0),
        ).where(current_user.is_superadmin or Room.workspace_id == workspace_id)
    ).one()
    active_agents = (
        db.scalar(
            select(func.count(AgentDefinition.id)).where(
                (current_user.is_superadmin or AgentDefinition.workspace_id == workspace_id),
                AgentDefinition.is_active.is_(True),
            )
        )
        or 0
    )
    total_reactions = (
        db.scalar(
            select(func.count(MessageReaction.id))
            .join(Message, Message.id == MessageReaction.message_id)
            .join(Room, Room.id == Message.room_id)
            .where(current_user.is_superadmin or Room.workspace_id == workspace_id)
        )
        or 0
    )
    contribution_rows = db.execute(
        select(Message.author_agent_id, func.count(Message.id))
        .join(Room, Room.id == Message.room_id)
        .where(
            (current_user.is_superadmin or Room.workspace_id == workspace_id),
            Message.kind == MessageKind.MESSAGE,
            Message.author_agent_id.is_not(None),
        )
        .group_by(Message.author_agent_id)
        .order_by(func.count(Message.id).desc())
    ).all()
    event_rows = db.execute(
        select(ConversationEvent, Room.name)
        .join(Room, Room.id == ConversationEvent.room_id)
        .where(
            (current_user.is_superadmin or Room.workspace_id == workspace_id),
            ConversationEvent.event_type.notin_(("agent.typing", "agent.idle")),
        )
        .order_by(ConversationEvent.created_at.desc())
        .limit(30)
    ).all()
    return WorkspaceAnalyticsRead(
        total_messages=total_messages,
        human_messages=human_messages,
        agent_messages=agent_messages,
        total_reactions=total_reactions,
        cloud_cost=cloud_cost,
        cloud_tokens=cloud_tokens,
        local_tokens=local_tokens,
        active_agents=active_agents,
        contributions=[
            AgentContributionRead(agent_id=agent_id, message_count=count)
            for agent_id, count in contribution_rows
            if agent_id is not None
        ],
        recent_events=[
            AnalyticsEventRead(
                id=event.id,
                room_id=event.room_id,
                room_name=room_name,
                event_type=event.event_type,
                actor_agent_id=event.actor_agent_id,
                occurred_at=event.created_at,
            )
            for event, room_name in event_rows
        ],
    )


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
