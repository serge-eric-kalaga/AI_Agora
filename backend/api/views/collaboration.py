"""Gestion des accès à un espace et notifications personnelles."""

import hashlib
import re
import secrets
from datetime import timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Query, Response
from sqlalchemy import select

from api.database.models import (
    AgentDefinition,
    Message,
    Notification,
    Room,
    User,
    Workspace,
    WorkspaceInvitation,
    WorkspaceMember,
    WorkspaceRole,
    utcnow,
)
from api.dependencies import CurrentUser, DbSession, require_workspace_member
from api.errors import DomainError, NotFoundError
from api.schemas.collaboration import (
    InvitationAccept,
    InvitationCreate,
    InvitationCreated,
    InvitationRead,
    MemberRead,
    NotificationRead,
    RoleUpdate,
)
from api.schemas.common import Page
from api.services.audit import record_audit

router = APIRouter(prefix="/workspaces", tags=["Collaboration"])


def _admin(db: DbSession, workspace_id: UUID, user: User) -> WorkspaceMember:
    member = require_workspace_member(db, workspace_id, user)
    if member.role not in {WorkspaceRole.OWNER, WorkspaceRole.ADMIN}:
        raise DomainError("admin_required", "Seul un administrateur peut gérer les accès.", 403)
    return member


def _assignable(member: WorkspaceMember, role: str) -> None:
    if member.role != WorkspaceRole.OWNER and role == "admin":
        raise DomainError(
            "owner_required", "Seul le propriétaire peut désigner un administrateur.", 403
        )


@router.get(
    "/{workspace_id}/members",
    response_model=Page[MemberRead],
    summary="Lister les collaborateurs",
    description="Tous les membres peuvent reconnaître les auteurs. Les adresses email restent réservées aux administrateurs et au membre concerné.",
)
def members(workspace_id: UUID, db: DbSession, current_user: CurrentUser) -> Page[MemberRead]:
    viewer = require_workspace_member(db, workspace_id, current_user)
    rows = db.execute(
        select(WorkspaceMember, User)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == workspace_id)
        .order_by(User.username)
    ).all()
    return Page(
        items=[
            MemberRead(
                user_id=u.id,
                username=u.username,
                email=u.email
                if viewer.role in {WorkspaceRole.OWNER, WorkspaceRole.ADMIN}
                or u.id == current_user.id
                else None,
                role=m.role.value,
            )
            for m, u in rows
        ]
    )


@router.patch(
    "/{workspace_id}/members/{user_id}",
    response_model=MemberRead,
    summary="Modifier un rôle",
    description="Le propriétaire est immuable. Un administrateur ne peut ni modifier un autre administrateur ni attribuer ce rôle. La mise à jour est auditée et sérialisée par espace.",
)
def update_role(
    workspace_id: UUID, user_id: UUID, payload: RoleUpdate, db: DbSession, current_user: CurrentUser
) -> MemberRead:
    db.scalar(select(Workspace).where(Workspace.id == workspace_id).with_for_update())
    actor = _admin(db, workspace_id, current_user)
    _assignable(actor, payload.role)
    member = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id
        )
    )
    if not member:
        raise NotFoundError("member_not_found", "Collaborateur introuvable.")
    if member.role == WorkspaceRole.OWNER or (
        member.role == WorkspaceRole.ADMIN and actor.role != WorkspaceRole.OWNER
    ):
        raise DomainError("protected_role", "Ce rôle ne peut pas être modifié.", 403)
    member.role = WorkspaceRole(payload.role)
    record_audit(
        db,
        action="member.role_updated",
        resource_type="user",
        resource_id=user_id,
        actor_user_id=current_user.id,
        workspace_id=workspace_id,
    )
    db.commit()
    user = db.get(User, user_id)
    assert user
    return MemberRead(
        user_id=user.id, username=user.username, email=user.email, role=member.role.value
    )


@router.post(
    "/{workspace_id}/invitations",
    response_model=InvitationCreated,
    status_code=201,
    summary="Créer une invitation par lien",
    description="Lien secret valable sept jours, lié à une adresse et à usage unique. Aucun email n'est envoyé. Seul le condensat est stocké ; le secret n'est retourné qu'à la création. Seul le propriétaire peut inviter un administrateur.",
)
def invite(
    workspace_id: UUID, payload: InvitationCreate, db: DbSession, current_user: CurrentUser
) -> InvitationCreated:
    actor = _admin(db, workspace_id, current_user)
    _assignable(actor, payload.role)
    token = secrets.token_urlsafe(48)
    invitation = WorkspaceInvitation(
        workspace_id=workspace_id,
        email=str(payload.email).lower(),
        role=WorkspaceRole(payload.role),
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        expires_at=utcnow() + timedelta(days=7),
    )
    db.add(invitation)
    db.flush()
    record_audit(
        db,
        action="invitation.created",
        resource_type="invitation",
        resource_id=invitation.id,
        actor_user_id=current_user.id,
        workspace_id=workspace_id,
    )
    db.commit()
    return InvitationCreated(**InvitationRead.model_validate(invitation).model_dump(), token=token)


@router.get(
    "/{workspace_id}/invitations",
    response_model=Page[InvitationRead],
    summary="Lister les invitations sans leur secret",
)
def invitations(
    workspace_id: UUID, db: DbSession, current_user: CurrentUser
) -> Page[InvitationRead]:
    _admin(db, workspace_id, current_user)
    return Page(
        items=[
            InvitationRead.model_validate(i)
            for i in db.scalars(
                select(WorkspaceInvitation)
                .where(WorkspaceInvitation.workspace_id == workspace_id)
                .order_by(WorkspaceInvitation.created_at.desc())
                .limit(100)
            )
        ]
    )


@router.delete(
    "/{workspace_id}/invitations/{invitation_id}",
    status_code=204,
    summary="Révoquer une invitation",
    description="La révocation interdit toute acceptation ultérieure. Elle est auditée ; un lien déjà accepté ne retire pas l'accès du membre.",
)
def revoke(
    workspace_id: UUID, invitation_id: UUID, db: DbSession, current_user: CurrentUser
) -> Response:
    _admin(db, workspace_id, current_user)
    invitation = db.scalar(
        select(WorkspaceInvitation)
        .where(
            WorkspaceInvitation.id == invitation_id,
            WorkspaceInvitation.workspace_id == workspace_id,
        )
        .with_for_update()
    )
    if not invitation:
        raise NotFoundError("invitation_not_found", "Invitation introuvable.")
    invitation.revoked_at = utcnow()
    record_audit(
        db,
        action="invitation.revoked",
        resource_type="invitation",
        resource_id=invitation.id,
        actor_user_id=current_user.id,
        workspace_id=workspace_id,
    )
    db.commit()
    return Response(status_code=204)


@router.post(
    "/invitations/accept",
    summary="Accepter une invitation",
    description="Nécessite un compte connecté dont l'adresse correspond à l'invitation. Vérifie expiration et révocation sous verrou. Ne change jamais le rôle d'un membre déjà présent et ne permet pas la réutilisation du secret.",
)
def accept(payload: InvitationAccept, db: DbSession, current_user: CurrentUser) -> dict[str, str]:
    invitation = db.scalar(
        select(WorkspaceInvitation)
        .where(WorkspaceInvitation.token_hash == hashlib.sha256(payload.token.encode()).hexdigest())
        .with_for_update()
    )
    expires = (
        invitation.expires_at.replace(tzinfo=timezone.utc)
        if invitation and invitation.expires_at.tzinfo is None
        else invitation.expires_at
        if invitation
        else None
    )
    if (
        not invitation
        or not expires
        or expires <= utcnow()
        or invitation.revoked_at
        or invitation.accepted_at
        or invitation.email != current_user.email.lower()
    ):
        raise DomainError(
            "invalid_invitation", "Invitation invalide, expirée ou destinée à un autre compte.", 422
        )
    db.scalar(select(Workspace).where(Workspace.id == invitation.workspace_id).with_for_update())
    member = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == invitation.workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
    )
    if not member:
        db.add(
            WorkspaceMember(
                workspace_id=invitation.workspace_id, user_id=current_user.id, role=invitation.role
            )
        )
    invitation.accepted_at = utcnow()
    record_audit(
        db,
        action="invitation.accepted",
        resource_type="invitation",
        resource_id=invitation.id,
        actor_user_id=current_user.id,
        workspace_id=invitation.workspace_id,
    )
    db.commit()
    return {"workspaceId": str(invitation.workspace_id)}


@router.get(
    "/{workspace_id}/notifications",
    response_model=Page[NotificationRead],
    summary="Lire mes notifications",
    description="Mentions et réponses personnelles uniquement, triées de la plus récente à la plus ancienne. Pagination par identifiant de notification. Un membre ne peut pas lire les alertes d'un autre.",
)
def notifications(
    workspace_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
    cursor: UUID | None = None,
    limit: int = Query(30, ge=1, le=100),
) -> Page[NotificationRead]:
    require_workspace_member(db, workspace_id, current_user)
    query = select(Notification).where(
        Notification.workspace_id == workspace_id, Notification.user_id == current_user.id
    )
    if cursor:
        previous = db.get(Notification, cursor)
        if (
            not previous
            or previous.user_id != current_user.id
            or previous.workspace_id != workspace_id
        ):
            raise NotFoundError("notification_not_found", "Notification introuvable.")
        from sqlalchemy import and_, or_

        query = query.where(
            or_(
                Notification.created_at < previous.created_at,
                and_(Notification.created_at == previous.created_at, Notification.id < previous.id),
            )
        )
    rows = db.scalars(
        query.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit + 1)
    ).all()
    items = []
    for n in rows[:limit]:
        message = db.get(Message, n.message_id)
        assert message
        room = db.get(Room, message.room_id)
        assert room
        author = (
            db.get(AgentDefinition, message.author_agent_id)
            if message.author_agent_id
            else db.get(User, message.author_user_id)
            if message.author_user_id
            else None
        )
        name = (
            author.name
            if isinstance(author, AgentDefinition)
            else author.username
            if isinstance(author, User)
            else "Participant"
        )
        items.append(
            NotificationRead(
                id=n.id,
                kind=n.kind,
                room_id=room.id,
                room_name=room.name,
                message_id=message.id,
                thread_root_id=message.thread_root_id,
                author_name=name,
                excerpt=re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", message.content)[:240],
                created_at=n.created_at,
                read_at=n.read_at,
            )
        )
    return Page(items=items, next_cursor=str(rows[limit - 1].id) if len(rows) > limit else None)


@router.put(
    "/{workspace_id}/notifications/{notification_id}/read",
    status_code=204,
    summary="Marquer une notification comme lue",
    description="Modification idempotente, réservée au destinataire membre de l'espace.",
)
def read_notification(
    workspace_id: UUID, notification_id: UUID, db: DbSession, current_user: CurrentUser
) -> Response:
    require_workspace_member(db, workspace_id, current_user)
    n = db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.workspace_id == workspace_id,
            Notification.user_id == current_user.id,
        )
    )
    if not n:
        raise NotFoundError("notification_not_found", "Notification introuvable.")
    n.read_at = n.read_at or utcnow()
    db.commit()
    return Response(status_code=204)
