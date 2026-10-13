"""Administration globale en lecture, contrôlée depuis le compte en base."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, or_, select

from api.database.models import Message, MessageKind, Room, User, Workspace
from api.dependencies import CurrentUser, DbSession
from api.errors import DomainError, NotFoundError
from api.schemas.admin import AdminRoomRead, AdminUserRead
from api.schemas.common import Page
from api.schemas.rooms import MessageRead
from api.services.audit import record_audit
from api.views.rooms import _message_read

router = APIRouter(prefix="/admin", tags=["Administration globale"])


def require_superadmin(current_user: CurrentUser) -> User:
    if not current_user.is_superadmin:
        raise DomainError(
            "superadmin_required", "Cette page est réservée à l'administration globale.", 403
        )
    return current_user


Superadmin = Annotated[User, Depends(require_superadmin)]


def _literal(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get(
    "/users",
    response_model=Page[AdminUserRead],
    summary="Voir tous les utilisateurs",
    description="Lecture globale réservée au superadmin actif. Recherche littérale par nom/adresse et pagination stable par date/UUID. Aucun mot de passe, condensat ou secret de session n'est exposé. La consultation est auditée.",
)
def users(
    db: DbSession,
    current_user: Superadmin,
    q: str = Query("", max_length=100),
    cursor: UUID | None = None,
    limit: int = Query(30, ge=1, le=100),
) -> Page[AdminUserRead]:
    query = select(User)
    if q:
        term = f"%{_literal(q)}%"
        query = query.where(
            or_(User.username.ilike(term, escape="\\"), User.email.ilike(term, escape="\\"))
        )
    if cursor:
        previous = db.get(User, cursor)
        if not previous:
            raise NotFoundError("cursor_not_found", "Curseur introuvable.")
        query = query.where(
            or_(
                User.created_at < previous.created_at,
                and_(User.created_at == previous.created_at, User.id < previous.id),
            )
        )
    rows = db.scalars(query.order_by(User.created_at.desc(), User.id.desc()).limit(limit + 1)).all()
    record_audit(
        db,
        action="admin.users_viewed",
        resource_type="user",
        resource_id=current_user.id,
        actor_user_id=current_user.id,
        workspace_id=None,
    )
    db.commit()
    return Page(
        items=[AdminUserRead.model_validate(u) for u in rows[:limit]],
        next_cursor=str(rows[limit - 1].id) if len(rows) > limit else None,
    )


@router.get(
    "/rooms",
    response_model=Page[AdminRoomRead],
    summary="Voir toutes les salles de tous les espaces",
    description="Recherche par nom/sujet, isolation des autres routes conservée. Liste paginée des salles, espace d'origine et volume des messages ; consultation auditée.",
)
def rooms(
    db: DbSession,
    current_user: Superadmin,
    q: str = Query("", max_length=100),
    cursor: UUID | None = None,
    limit: int = Query(30, ge=1, le=100),
) -> Page[AdminRoomRead]:
    query = select(Room, Workspace.name).join(Workspace, Workspace.id == Room.workspace_id)
    if q:
        term = f"%{_literal(q)}%"
        query = query.where(
            or_(Room.name.ilike(term, escape="\\"), Room.topic.ilike(term, escape="\\"))
        )
    if cursor:
        previous = db.get(Room, cursor)
        if not previous:
            raise NotFoundError("cursor_not_found", "Curseur introuvable.")
        query = query.where(
            or_(
                Room.created_at < previous.created_at,
                and_(Room.created_at == previous.created_at, Room.id < previous.id),
            )
        )
    rows = db.execute(query.order_by(Room.created_at.desc(), Room.id.desc()).limit(limit + 1)).all()
    counts: dict[UUID, int] = {
        room_id: count
        for room_id, count in db.execute(
            select(Message.room_id, func.count(Message.id))
            .where(
                Message.room_id.in_([r.id for r, _ in rows]), Message.kind == MessageKind.MESSAGE
            )
            .group_by(Message.room_id)
        ).all()
    }
    record_audit(
        db,
        action="admin.rooms_viewed",
        resource_type="user",
        resource_id=current_user.id,
        actor_user_id=current_user.id,
        workspace_id=None,
    )
    db.commit()
    return Page(
        items=[
            AdminRoomRead(
                id=r.id,
                workspace_id=r.workspace_id,
                workspace_name=name,
                name=r.name,
                topic=r.topic,
                status=r.status.value,
                message_count=counts.get(r.id, 0),
                created_at=r.created_at,
            )
            for r, name in rows[:limit]
        ],
        next_cursor=str(rows[limit - 1][0].id) if len(rows) > limit else None,
    )


@router.get(
    "/rooms/{room_id}/messages",
    response_model=Page[MessageRead],
    summary="Consulter une salle en lecture globale",
    description="Messages principaux et fils, auteurs et références visibles ; aucune mutation ou génération n'est autorisée par cette route. Pagination des plus récents aux plus anciens. L'accès à chaque salle est audité.",
)
def messages(
    room_id: UUID,
    db: DbSession,
    current_user: Superadmin,
    cursor: UUID | None = None,
    limit: int = Query(30, ge=1, le=100),
) -> Page[MessageRead]:
    room = db.get(Room, room_id)
    if not room:
        raise NotFoundError("room_not_found", "Salle introuvable.")
    query = select(Message).where(Message.room_id == room_id)
    if cursor:
        previous = db.get(Message, cursor)
        if not previous or previous.room_id != room_id:
            raise NotFoundError("cursor_not_found", "Curseur introuvable.")
        query = query.where(
            or_(
                Message.created_at < previous.created_at,
                and_(Message.created_at == previous.created_at, Message.id < previous.id),
            )
        )
    rows = db.scalars(
        query.order_by(Message.created_at.desc(), Message.id.desc()).limit(limit + 1)
    ).all()
    record_audit(
        db,
        action="admin.room_viewed",
        resource_type="room",
        resource_id=room_id,
        actor_user_id=current_user.id,
        workspace_id=room.workspace_id,
    )
    db.commit()
    return Page(
        items=[_message_read(db, m, current_user.id) for m in rows[:limit]],
        next_cursor=str(rows[limit - 1].id) if len(rows) > limit else None,
    )
