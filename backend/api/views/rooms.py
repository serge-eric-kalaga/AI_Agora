"""Cycle de vie des arènes, messages, réactions et flux d'événements."""

import asyncio
import logging
from collections import Counter
from datetime import datetime, timezone
from uuid import UUID

from celery.exceptions import OperationalError
from fastapi import APIRouter, Header, Query, Request, status
from redis.exceptions import RedisError
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import Select
from starlette.responses import StreamingResponse

from api.configs import get_settings
from api.database import SessionLocal
from api.database.models import (
    AgentDefinition,
    ConversationEvent,
    IdempotencyRecord,
    Message,
    MessageKind,
    MessageReaction,
    Room,
    RoomMemory,
    RoomParticipant,
    RoomStatus,
    User,
)
from api.dependencies import (
    CurrentUser,
    DbSession,
    require_workspace_editor,
    require_workspace_member,
)
from api.errors import ConflictError, DomainError, NotFoundError
from api.schemas.common import Page
from api.schemas.memory import MemoryRead
from api.schemas.rooms import (
    ConversationSettings,
    ConversationSettingsUpdate,
    EventRead,
    MessageCreate,
    MessageRead,
    ParticipantRead,
    ParticipantUpdate,
    ReactionActorRead,
    ReactionRead,
    ReactionUpdate,
    RoomCreate,
    RoomRead,
    RoomStatusUpdate,
)
from api.services.audit import record_audit
from api.services.events import append_room_event
from api.services.notifications import notify_message

router = APIRouter(prefix="/workspaces/{workspace_id}/rooms", tags=["Arènes"])
logger = logging.getLogger(__name__)
ALLOWED_REACTIONS = {"👍", "👎", "❤️", "🎯", "💡", "🤔"}


def _room_query() -> Select[tuple[Room]]:
    return select(Room).options(selectinload(Room.participants))


def _room(db: DbSession, workspace_id: UUID, room_id: UUID) -> Room:
    room = db.scalar(_room_query().where(Room.id == room_id, Room.workspace_id == workspace_id))
    if not room:
        raise NotFoundError("room_not_found", "L'arène demandée est introuvable.")
    return room


def _room_read(room: Room) -> RoomRead:
    return RoomRead(
        id=room.id,
        workspace_id=room.workspace_id,
        created_by_id=room.created_by_id,
        name=room.name,
        description=room.description,
        topic=room.topic,
        language=room.language,
        mode=room.mode,
        temporal_mode=room.temporal_mode,
        visibility=room.visibility,
        status=room.status,
        rules=room.rules,
        tools=room.tools,
        budget_limit=room.budget_limit,
        amount_spent=room.amount_spent,
        max_messages=room.max_messages,
        max_duration_minutes=room.max_duration_minutes,
        cloud_tokens=room.cloud_tokens,
        local_tokens=room.local_tokens,
        version=room.version,
        conversation_settings=ConversationSettings.model_validate(room.conversation_settings or {}),
        participants=[
            ParticipantRead(
                agent_id=item.agent_id,
                instructions=item.instructions,
                is_active=item.is_active,
            )
            for item in room.participants
        ],
        started_at=room.started_at,
        stopped_at=room.stopped_at,
        created_at=room.created_at,
        updated_at=room.updated_at,
    )


def _event_read(event: ConversationEvent) -> EventRead:
    return EventRead(
        id=event.id,
        room_id=event.room_id,
        cursor=str(event.sequence),
        occurred_at=event.created_at,
        payload=event.payload,
    )


def _message_read(db: DbSession, message: Message, user_id: UUID) -> MessageRead:
    rows = db.execute(
        select(
            MessageReaction.emoji,
            MessageReaction.user_id,
            MessageReaction.agent_id,
            MessageReaction.created_at,
        )
        .where(MessageReaction.message_id == message.id)
        .order_by(MessageReaction.created_at)
    ).all()
    counts = Counter(emoji for emoji, _, _, _ in rows)
    mine = {emoji for emoji, reaction_user_id, _, _ in rows if reaction_user_id == user_id}
    user_ids = {reaction_user_id for _, reaction_user_id, _, _ in rows if reaction_user_id}
    agent_ids = {reaction_agent_id for _, _, reaction_agent_id, _ in rows if reaction_agent_id}
    user_names: dict[UUID, str] = {}
    if user_ids:
        user_names = {
            actor_id: username
            for actor_id, username in db.execute(
                select(User.id, User.username).where(User.id.in_(user_ids))
            )
        }
    agent_names: dict[UUID, str] = {}
    if agent_ids:
        agent_names = {
            actor_id: name
            for actor_id, name in db.execute(
                select(AgentDefinition.id, AgentDefinition.name).where(
                    AgentDefinition.id.in_(agent_ids)
                )
            )
        }

    def reaction_actors(emoji: str) -> list[ReactionActorRead]:
        actors: list[ReactionActorRead] = []
        for reaction_emoji, reaction_user_id, reaction_agent_id, _ in rows:
            if reaction_emoji != emoji or len(actors) >= 3:
                continue
            if reaction_agent_id:
                actors.append(
                    ReactionActorRead(
                        id=reaction_agent_id,
                        display_name=agent_names.get(reaction_agent_id, "Agent"),
                        kind="agent",
                    )
                )
            elif reaction_user_id:
                actors.append(
                    ReactionActorRead(
                        id=reaction_user_id,
                        display_name=user_names.get(reaction_user_id, "Membre"),
                        kind="user",
                        is_me=reaction_user_id == user_id,
                    )
                )
        return actors

    return MessageRead(
        id=message.id,
        room_id=message.room_id,
        author_user_id=message.author_user_id,
        author_user_name=(
            author.username if (author := db.get(User, message.author_user_id)) else None
        )
        if message.author_user_id
        else None,
        is_me=message.author_user_id == user_id,
        author_agent_id=message.author_agent_id,
        author_agent_name=(
            author_agent.name
            if (author_agent := db.get(AgentDefinition, message.author_agent_id))
            else None
        )
        if message.author_agent_id
        else None,
        reply_to_id=message.reply_to_id,
        thread_root_id=message.thread_root_id,
        kind=message.kind,
        content=message.content,
        metadata=message.metadata_json,
        reactions=[
            ReactionRead(
                emoji=emoji,
                count=count,
                reacted_by_me=emoji in mine,
                agent_ids=[
                    reaction_agent_id
                    for reaction_emoji, _, reaction_agent_id, _ in rows
                    if reaction_emoji == emoji and reaction_agent_id is not None
                ],
                actors=reaction_actors(emoji),
            )
            for emoji, count in sorted(counts.items())
        ],
        created_at=message.created_at,
    )


def _validate_agents(db: DbSession, workspace_id: UUID, agent_ids: list[UUID]) -> None:
    found = set(
        db.scalars(
            select(AgentDefinition.id).where(
                AgentDefinition.workspace_id == workspace_id,
                AgentDefinition.id.in_(agent_ids),
                AgentDefinition.is_active.is_(True),
            )
        ).all()
    )
    if found != set(agent_ids):
        raise DomainError(
            "invalid_participants",
            "Chaque participant doit être un agent actif de cet espace.",
            422,
        )


@router.get("", response_model=Page[RoomRead], summary="Lister les arènes")
def list_rooms(workspace_id: UUID, db: DbSession, current_user: CurrentUser) -> Page[RoomRead]:
    require_workspace_member(db, workspace_id, current_user)
    rooms = db.scalars(
        _room_query().where(Room.workspace_id == workspace_id).order_by(Room.created_at.desc())
    ).all()
    return Page(items=[_room_read(room) for room in rooms])


@router.post(
    "",
    response_model=RoomRead,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une arène idempotente",
    description="Exige au moins deux agents actifs. Réutiliser X-Idempotency-Key renvoie la même arène.",
)
def create_room(
    workspace_id: UUID,
    payload: RoomCreate,
    db: DbSession,
    current_user: CurrentUser,
    idempotency_key: str = Header(min_length=8, max_length=100, alias="X-Idempotency-Key"),
) -> RoomRead:
    require_workspace_editor(db, workspace_id, current_user)
    existing = db.scalar(
        select(IdempotencyRecord).where(
            IdempotencyRecord.workspace_id == workspace_id,
            IdempotencyRecord.scope == "room.create",
            IdempotencyRecord.key == idempotency_key,
        )
    )
    if existing:
        return _room_read(_room(db, workspace_id, existing.resource_id))
    _validate_agents(db, workspace_id, payload.participant_ids)
    values = payload.model_dump(exclude={"participant_ids"})
    # Une conversation reste ouverte jusqu'à une action humaine, la durée ou le budget configuré.
    values["max_messages"] = None
    room = Room(workspace_id=workspace_id, created_by_id=current_user.id, **values)
    db.add(room)
    db.flush()
    for agent_id in payload.participant_ids:
        db.add(RoomParticipant(room_id=room.id, agent_id=agent_id))
    db.add(
        IdempotencyRecord(
            workspace_id=workspace_id,
            scope="room.create",
            key=idempotency_key,
            resource_id=room.id,
        )
    )
    append_room_event(
        db,
        room.id,
        "room.created",
        {"roomId": str(room.id)},
        actor_user_id=current_user.id,
        idempotency_key=idempotency_key,
    )
    record_audit(
        db,
        action="room.created",
        resource_type="room",
        resource_id=room.id,
        actor_user_id=current_user.id,
        workspace_id=workspace_id,
        details={"participants": [str(item) for item in payload.participant_ids]},
    )
    db.commit()
    return _room_read(_room(db, workspace_id, room.id))


@router.get("/{room_id}", response_model=RoomRead, summary="Lire une arène")
def get_room(
    workspace_id: UUID, room_id: UUID, db: DbSession, current_user: CurrentUser
) -> RoomRead:
    require_workspace_member(db, workspace_id, current_user)
    return _room_read(_room(db, workspace_id, room_id))


@router.patch(
    "/{room_id}/status",
    response_model=RoomRead,
    summary="Démarrer, suspendre ou arrêter une arène",
    description="Applique une machine à états et un contrôle de version afin d'éviter deux commandes concurrentes.",
)
def set_room_status(
    workspace_id: UUID,
    room_id: UUID,
    payload: RoomStatusUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> RoomRead:
    require_workspace_editor(db, workspace_id, current_user)
    room = _room(db, workspace_id, room_id)
    if room.version != payload.expected_version:
        raise ConflictError(
            "stale_room_version", "L'arène a changé; rechargez-la avant de réessayer."
        )
    transitions = {
        RoomStatus.DRAFT: {RoomStatus.RUNNING, RoomStatus.STOPPED},
        RoomStatus.RUNNING: {RoomStatus.PAUSED, RoomStatus.STOPPED},
        RoomStatus.PAUSED: {RoomStatus.RUNNING, RoomStatus.STOPPED},
        RoomStatus.STOPPED: set(),
    }
    target = RoomStatus(payload.status)
    if target not in transitions[room.status]:
        raise ConflictError(
            "invalid_room_transition", f"Transition {room.status.value} → {target.value} interdite."
        )
    active_count = sum(1 for item in room.participants if item.is_active)
    if target == RoomStatus.RUNNING and active_count < 2:
        raise ConflictError(
            "not_enough_participants", "Deux agents actifs sont requis pour démarrer."
        )
    room.status = target
    room.version += 1
    if target == RoomStatus.RUNNING and room.started_at is None:
        room.started_at = datetime.now(timezone.utc)
    if target == RoomStatus.STOPPED:
        room.stopped_at = datetime.now(timezone.utc)
    append_room_event(
        db,
        room.id,
        f"room.{target.value}",
        {"roomId": str(room.id), "version": room.version},
        actor_user_id=current_user.id,
    )
    record_audit(
        db,
        action=f"room.{target.value}",
        resource_type="room",
        resource_id=room.id,
        actor_user_id=current_user.id,
        workspace_id=workspace_id,
        details={"version": room.version},
    )
    pending_event_id: UUID | None = None
    if target == RoomStatus.RUNNING:
        recent_message_events = db.scalars(
            select(ConversationEvent)
            .where(
                ConversationEvent.room_id == room.id,
                ConversationEvent.event_type == "message.created",
            )
            .order_by(ConversationEvent.sequence.desc())
            .limit(20)
        ).all()
        for candidate in recent_message_events:
            completed = db.scalar(
                select(ConversationEvent.id).where(
                    ConversationEvent.room_id == room.id,
                    ConversationEvent.idempotency_key == f"agent-turn:{candidate.id}",
                )
            )
            if not completed:
                pending_event_id = candidate.id
                break
    db.commit()
    if pending_event_id and get_settings().app_environment != "test":
        from api.tasks import schedule_room_turn

        try:
            schedule_room_turn(str(room.id), str(pending_event_id), force=True)
        except (OperationalError, RedisError):
            logger.exception("Impossible de reprendre la conversation room_id=%s", room.id)
    return _room_read(_room(db, workspace_id, room.id))


@router.put(
    "/{room_id}/participants/{agent_id}",
    response_model=RoomRead,
    summary="Ajouter ou retirer logiquement un participant",
)
def set_participant(
    workspace_id: UUID,
    room_id: UUID,
    agent_id: UUID,
    payload: ParticipantUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> RoomRead:
    require_workspace_editor(db, workspace_id, current_user)
    room = _room(db, workspace_id, room_id)
    if room.status == RoomStatus.STOPPED:
        raise ConflictError("room_stopped", "Une arène arrêtée ne peut plus être modifiée.")
    if room.version != payload.expected_version:
        raise ConflictError(
            "stale_room_version", "L'arène a changé; rechargez-la avant de réessayer."
        )
    _validate_agents(db, workspace_id, [agent_id])
    participant = db.scalar(
        select(RoomParticipant).where(
            RoomParticipant.room_id == room.id,
            RoomParticipant.agent_id == agent_id,
        )
    )
    if not participant:
        participant = RoomParticipant(room_id=room.id, agent_id=agent_id)
        db.add(participant)
    participant.is_active = payload.present
    participant.instructions = payload.instructions
    room.version += 1
    event_type = "agent.joined" if payload.present else "agent.left"
    append_room_event(
        db,
        room.id,
        event_type,
        {"agentId": str(agent_id)},
        actor_user_id=current_user.id,
    )
    db.commit()
    return _room_read(_room(db, workspace_id, room.id))


@router.get(
    "/{room_id}/messages",
    response_model=Page[MessageRead],
    summary="Lister les messages",
    description=(
        "Retourne les messages les plus récents dans l'ordre chronologique. "
        "Transmettre le curseur `before` pour charger progressivement les messages plus anciens."
    ),
)
def list_messages(
    workspace_id: UUID,
    room_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
    before: UUID | None = Query(
        default=None, description="Identifiant du plus ancien message affiché."
    ),
    limit: int = Query(default=50, ge=1, le=100),
    thread_root_id: UUID | None = Query(
        default=None,
        description="Fil à consulter, avec son message racine. Absent : conversation principale.",
    ),
) -> Page[MessageRead]:
    require_workspace_member(db, workspace_id, current_user)
    _room(db, workspace_id, room_id)
    if thread_root_id:
        root = db.get(Message, thread_root_id)
        if (
            not root
            or root.room_id != room_id
            or root.thread_root_id
            or root.kind != MessageKind.MESSAGE
        ):
            raise NotFoundError("thread_not_found", "Le fil est introuvable dans cette salle.")
    query = select(Message).where(
        Message.room_id == room_id,
        or_(Message.thread_root_id == thread_root_id, Message.id == thread_root_id)
        if thread_root_id
        else Message.thread_root_id.is_(None),
    )
    if before:
        cursor_message = db.get(Message, before)
        if not cursor_message or cursor_message.room_id != room_id:
            raise DomainError(
                "invalid_message_cursor",
                "Le curseur de messages n'appartient pas à cette arène.",
                422,
            )
        query = query.where(
            or_(
                Message.created_at < cursor_message.created_at,
                and_(
                    Message.created_at == cursor_message.created_at,
                    Message.id < cursor_message.id,
                ),
            )
        )
    descending = db.scalars(
        query.order_by(Message.created_at.desc(), Message.id.desc()).limit(limit + 1)
    ).all()
    has_more = len(descending) > limit
    selected = descending[:limit]
    return Page(
        items=[_message_read(db, message, current_user.id) for message in reversed(selected)],
        next_cursor=str(selected[-1].id) if has_more and selected else None,
    )


@router.post(
    "/{room_id}/messages",
    response_model=MessageRead,
    status_code=status.HTTP_201_CREATED,
    summary="Publier un message idempotent",
)
def create_message(
    workspace_id: UUID,
    room_id: UUID,
    payload: MessageCreate,
    db: DbSession,
    current_user: CurrentUser,
    idempotency_key: str = Header(min_length=8, max_length=100, alias="X-Idempotency-Key"),
) -> MessageRead:
    require_workspace_editor(db, workspace_id, current_user)
    room = _room(db, workspace_id, room_id)
    existing = db.scalar(
        select(Message).where(
            Message.room_id == room_id, Message.idempotency_key == idempotency_key
        )
    )
    if existing:
        return _message_read(db, existing, current_user.id)
    if room.status == RoomStatus.STOPPED:
        raise ConflictError(
            "room_stopped", "Aucun message ne peut être ajouté à une arène arrêtée."
        )
    if room.amount_spent >= room.budget_limit:
        raise DomainError(
            "cost_budget_exhausted", "Le budget financier de l'arène est épuisé.", 422
        )
    reply = None
    if payload.reply_to_id:
        reply = db.get(Message, payload.reply_to_id)
        if not reply or reply.room_id != room.id:
            raise DomainError(
                "invalid_reply", "Le message cité n'appartient pas à cette arène.", 422
            )
    if payload.thread_root_id:
        root = db.get(Message, payload.thread_root_id)
        if (
            not root
            or root.room_id != room.id
            or root.thread_root_id
            or root.kind != MessageKind.MESSAGE
        ):
            raise DomainError(
                "invalid_thread", "La racine du fil doit appartenir à cette salle.", 422
            )
        if reply and reply.id != root.id and reply.thread_root_id != root.id:
            raise DomainError(
                "invalid_thread_reply", "Le message cité appartient à un autre fil.", 422
            )
    elif reply and reply.thread_root_id:
        raise DomainError("invalid_thread_reply", "Répondez à ce message dans son fil.", 422)
    message = Message(
        room_id=room.id,
        thread_root_id=payload.thread_root_id,
        author_user_id=current_user.id,
        reply_to_id=payload.reply_to_id,
        content=payload.content,
        idempotency_key=idempotency_key,
    )
    db.add(message)
    db.flush()
    notify_message(db, room, message)
    event = append_room_event(
        db,
        room.id,
        "message.created",
        {
            "messageId": str(message.id),
            "threadRootId": str(message.thread_root_id) if message.thread_root_id else None,
        },
        actor_user_id=current_user.id,
        idempotency_key=idempotency_key,
    )
    db.commit()
    db.refresh(message)
    if room.status == RoomStatus.RUNNING and get_settings().app_environment != "test":
        from api.tasks import schedule_room_turn

        try:
            schedule_room_turn(str(room.id), str(event.id))
        except (OperationalError, RedisError):
            # Le message humain reste valide même si la file est momentanément indisponible.
            logger.exception("Impossible de planifier le tour d'agent room_id=%s", room.id)
    return _message_read(db, message, current_user.id)


@router.put(
    "/{room_id}/messages/{message_id}/reactions/{emoji}",
    response_model=MessageRead,
    summary="Ajouter ou retirer une réaction",
)
def set_reaction(
    workspace_id: UUID,
    room_id: UUID,
    message_id: UUID,
    emoji: str,
    payload: ReactionUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> MessageRead:
    require_workspace_member(db, workspace_id, current_user)
    _room(db, workspace_id, room_id)
    if emoji not in ALLOWED_REACTIONS:
        raise DomainError("unsupported_reaction", "Cette réaction n'est pas prise en charge.", 422)
    message = db.get(Message, message_id)
    if not message or message.room_id != room_id:
        raise NotFoundError("message_not_found", "Le message demandé est introuvable.")
    reaction = db.scalar(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == current_user.id,
            MessageReaction.emoji == emoji,
        )
    )
    if payload.present and not reaction:
        db.add(MessageReaction(message_id=message_id, user_id=current_user.id, emoji=emoji))
    elif not payload.present and reaction:
        db.delete(reaction)
    append_room_event(
        db,
        room_id,
        "reaction.updated",
        {"messageId": str(message_id), "emoji": emoji, "present": payload.present},
        actor_user_id=current_user.id,
    )
    db.commit()
    return _message_read(db, message, current_user.id)


@router.get(
    "/{room_id}/events", response_model=Page[EventRead], summary="Relire les événements ordonnés"
)
def list_events(
    workspace_id: UUID,
    room_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
    cursor: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
) -> Page[EventRead]:
    require_workspace_member(db, workspace_id, current_user)
    _room(db, workspace_id, room_id)
    events = db.scalars(
        select(ConversationEvent)
        .where(ConversationEvent.room_id == room_id, ConversationEvent.sequence > cursor)
        .order_by(ConversationEvent.sequence)
        .limit(limit + 1)
    ).all()
    has_more = len(events) > limit
    selected = events[:limit]
    return Page(
        items=[_event_read(event) for event in selected],
        next_cursor=str(selected[-1].sequence) if has_more and selected else None,
    )


@router.get(
    "/{room_id}/stream",
    response_class=StreamingResponse,
    summary="Suivre les événements en Server-Sent Events",
    description="Reprend après le curseur query ou l'en-tête Last-Event-ID. Un heartbeat conserve la connexion.",
)
async def stream_events(
    workspace_id: UUID,
    room_id: UUID,
    request: Request,
    db: DbSession,
    current_user: CurrentUser,
    cursor: int = Query(default=0, ge=0),
) -> StreamingResponse:
    require_workspace_member(db, workspace_id, current_user)
    _room(db, workspace_id, room_id)
    header_cursor = request.headers.get("Last-Event-ID")
    start_cursor = int(header_cursor) if header_cursor and header_cursor.isdigit() else cursor
    settings = get_settings()

    async def generator():  # type: ignore[no-untyped-def]
        last_sequence = start_cursor
        last_heartbeat = asyncio.get_running_loop().time()
        while not await request.is_disconnected():
            with SessionLocal() as session:
                events = session.scalars(
                    select(ConversationEvent)
                    .where(
                        ConversationEvent.room_id == room_id,
                        ConversationEvent.sequence > last_sequence,
                    )
                    .order_by(ConversationEvent.sequence)
                    .limit(100)
                ).all()
                for event in events:
                    body = _event_read(event).model_dump_json(by_alias=True)
                    yield f"id: {event.sequence}\nevent: {event.event_type}\ndata: {body}\n\n"
                    last_sequence = event.sequence
            now = asyncio.get_running_loop().time()
            if now - last_heartbeat >= settings.sse_heartbeat_seconds:
                # Un événement nommé permet au navigateur de détecter aussi une
                # connexion silencieuse, sans déclencher de relecture de la salle.
                yield "event: heartbeat\ndata: {}\n\n"
                last_heartbeat = now
            await asyncio.sleep(settings.sse_poll_interval_seconds)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/{room_id}/memory",
    response_model=MemoryRead,
    summary="Lire la mémoire et la synthèse référencée d’une salle",
    description="Retourne positions, questions ouvertes, engagements, accords et désaccords avec leurs messages sources. "
    "Accessible aux membres, y compris observateurs. Une liste vide signifie qu’aucune synthèse vérifiée n’est encore disponible.",
)
def get_memory(
    workspace_id: UUID, room_id: UUID, db: DbSession, current_user: CurrentUser
) -> MemoryRead:
    require_workspace_member(db, workspace_id, current_user)
    _room(db, workspace_id, room_id)
    memory = db.get(RoomMemory, room_id)
    if not memory:
        return MemoryRead()
    return MemoryRead(
        **memory.state,
        updated_at=memory.updated_at,
        through_message_id=memory.through_message_id,
        revision=memory.revision,
    )


@router.post(
    "/{room_id}/memory",
    status_code=202,
    response_model=dict[str, str],
    summary="Demander une synthèse vérifiable en arrière-plan",
    description="Réservé aux membres qui peuvent écrire. Met en file la consolidation des nouveaux messages par le modèle d’un participant. "
    "La mémoire précédente reste disponible pendant le calcul. Le résultat est annoncé par l’événement memory.updated ; "
    "une sortie non vérifiable ne remplace jamais la mémoire existante.",
)
def request_memory(
    workspace_id: UUID, room_id: UUID, db: DbSession, current_user: CurrentUser
) -> dict[str, str]:
    require_workspace_editor(db, workspace_id, current_user)
    _room(db, workspace_id, room_id)
    from api.tasks import refresh_room_memory

    try:
        refresh_room_memory.delay(str(room_id), force=True)
    except (OperationalError, RedisError) as exc:
        raise DomainError(
            "queue_unavailable", "La synthèse ne peut pas être planifiée pour le moment.", 503
        ) from exc
    record_audit(
        db,
        workspace_id=workspace_id,
        actor_user_id=current_user.id,
        action="room.memory.requested",
        resource_type="room",
        resource_id=room_id,
    )
    db.commit()
    return {"status": "queued"}


@router.patch(
    "/{room_id}/conversation-settings",
    response_model=RoomRead,
    summary="Régler le rythme, l'autonomie et la longueur des réponses",
    description="Réservé aux membres pouvant écrire. Le contrôle de version et le verrou serveur évitent les écrasements concurrents. Les réglages prennent effet au prochain tour ; ils ne coupent pas une génération en cours. La capacité réelle d'Ollama peut prolonger la pause minimale.",
    responses={
        403: {"description": "Observateur ou membre non autorisé"},
        409: {"description": "Version obsolète"},
    },
)
def update_conversation_settings(
    workspace_id: UUID,
    room_id: UUID,
    payload: ConversationSettingsUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> RoomRead:
    require_workspace_editor(db, workspace_id, current_user)
    room = db.scalar(
        _room_query().where(Room.id == room_id, Room.workspace_id == workspace_id).with_for_update()
    )
    if not room:
        raise NotFoundError("room_not_found", "La salle est introuvable.")
    if room.version != payload.expected_version:
        raise ConflictError(
            "stale_room_version", "La salle a changé ; rechargez-la avant de réessayer."
        )
    room.conversation_settings = payload.model_dump(exclude={"expected_version", "tools", "temporal_mode"})
    if payload.temporal_mode is not None:
        room.temporal_mode = payload.temporal_mode
    if payload.tools is not None:
        room.tools = list(dict.fromkeys(payload.tools))
    room.version += 1
    append_room_event(
        db,
        room.id,
        "room.settings.updated",
        {"version": room.version},
        actor_user_id=current_user.id,
    )
    record_audit(
        db,
        action="room.settings.updated",
        resource_type="room",
        resource_id=room.id,
        actor_user_id=current_user.id,
        workspace_id=workspace_id,
    )
    db.commit()
    return _room_read(room)


@router.get(
    "/{room_id}/messages/search",
    response_model=Page[MessageRead],
    summary="Rechercher des messages dans une salle",
    description="Recherche littérale insensible à la casse, filtrée par auteur agent ou humain et intervalle inclusif en UTC. Pagination stable par date puis identifiant, du plus récent au plus ancien. Le curseur doit appartenir à la salle. Tous les filtres sont cumulatifs ; aucun message d'un autre espace n'est accessible.",
)
def search_messages(
    workspace_id: UUID,
    room_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
    q: str = Query(
        default="", max_length=300, description="Texte littéral ; % et _ ne sont pas des jokers."
    ),
    agent_id: UUID | None = Query(default=None, description="Auteur agent."),
    user_id: UUID | None = Query(default=None, description="Auteur humain."),
    since: datetime | None = Query(
        default=None, description="Début inclusif, date avec fuseau obligatoire."
    ),
    until: datetime | None = Query(
        default=None, description="Fin inclusive, date avec fuseau obligatoire."
    ),
    before: UUID | None = Query(default=None, description="Curseur de la page précédente."),
    limit: int = Query(default=25, ge=1, le=50),
) -> Page[MessageRead]:
    require_workspace_member(db, workspace_id, current_user)
    _room(db, workspace_id, room_id)
    if any(value and value.tzinfo is None for value in (since, until)) or (
        since and until and since > until
    ):
        raise DomainError(
            "invalid_date_range", "Indiquez un intervalle valide avec un fuseau horaire.", 422
        )
    query = select(Message).where(Message.room_id == room_id)
    if q.strip():
        escaped = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(Message.content.ilike(f"%{escaped}%", escape="\\"))
    if agent_id:
        query = query.where(Message.author_agent_id == agent_id)
    if user_id:
        query = query.where(Message.author_user_id == user_id)
    if since:
        query = query.where(Message.created_at >= since)
    if until:
        query = query.where(Message.created_at <= until)
    if before:
        cursor = db.get(Message, before)
        if not cursor or cursor.room_id != room_id:
            raise DomainError(
                "invalid_message_cursor", "Le curseur appartient à une autre salle.", 422
            )
        query = query.where(
            or_(
                Message.created_at < cursor.created_at,
                and_(Message.created_at == cursor.created_at, Message.id < cursor.id),
            )
        )
    rows = db.scalars(
        query.order_by(Message.created_at.desc(), Message.id.desc()).limit(limit + 1)
    ).all()
    selected = rows[:limit]
    return Page(
        items=[_message_read(db, row, current_user.id) for row in selected],
        next_cursor=str(selected[-1].id) if len(rows) > limit else None,
    )


@router.get(
    "/{room_id}/messages/{message_id}/context",
    response_model=Page[MessageRead],
    summary="Retrouver un message et son contexte immédiat",
    description="Charge directement le message demandé avec au plus dix voisins avant et après, dans l'ordre chronologique. Ne nécessite pas de parcourir toutes les pages d'historique. Les contrôles d'espace et de salle s'appliquent à la cible et à ses voisins.",
)
def message_context(
    workspace_id: UUID, room_id: UUID, message_id: UUID, db: DbSession, current_user: CurrentUser
) -> Page[MessageRead]:
    require_workspace_member(db, workspace_id, current_user)
    _room(db, workspace_id, room_id)
    target = db.get(Message, message_id)
    if not target or target.room_id != room_id:
        raise NotFoundError("message_not_found", "Le message est introuvable dans cette salle.")
    query = select(Message).where(
        Message.room_id == room_id, Message.thread_root_id == target.thread_root_id
    )
    earlier = list(
        reversed(
            db.scalars(
                query.where(
                    or_(
                        Message.created_at < target.created_at,
                        and_(Message.created_at == target.created_at, Message.id < target.id),
                    )
                )
                .order_by(Message.created_at.desc(), Message.id.desc())
                .limit(10)
            ).all()
        )
    )
    later = db.scalars(
        query.where(
            or_(
                Message.created_at > target.created_at,
                and_(Message.created_at == target.created_at, Message.id > target.id),
            )
        )
        .order_by(Message.created_at, Message.id)
        .limit(10)
    ).all()
    return Page(
        items=[_message_read(db, row, current_user.id) for row in [*earlier, target, *later]]
    )
