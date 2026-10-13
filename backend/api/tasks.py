"""Tâches asynchrones d'orchestration des agents."""

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import cast
from uuid import UUID

from celery.exceptions import OperationalError
from redis import Redis
from redis.exceptions import RedisError
from sqlalchemy import case, func, select

from api.celery_app import celery_app
from api.configs import get_settings
from api.database import SessionLocal
from api.database.models import ConversationEvent, Room, RoomStatus
from api.services.conversation_memory import refresh_memory
from api.services.generation_capacity import LocalProviderBusy, renewed_lease
from api.services.model_clients import ModelProviderError
from api.services.orchestration import _prepare_turn, execute_room_turn, record_room_failure

logger = logging.getLogger(__name__)
SCHEDULE_MARKER_TTL_SECONDS = 7 * 24 * 60 * 60


class RoomTurnBusy(RuntimeError):
    """Indique qu'un autre worker orchestre déjà cette salle."""


def _execute_with_room_lock(room_id: UUID, event_id: UUID, lane: int = 0) -> dict[str, str]:
    """Autorise deux parcours indépendants, mais un seul travail par agent à la fois."""

    settings = get_settings()
    client = Redis.from_url(settings.redis_url)
    lock = client.lock(
        f"ai-agora:room:{room_id}:lane:{lane}:turn",
        timeout=settings.room_turn_lock_seconds,
        thread_local=False,
    )
    acquired = lock.acquire(blocking=True, blocking_timeout=1)
    if not acquired:
        client.close()
        raise RoomTurnBusy
    try:
        with renewed_lease(lock, settings.room_turn_lock_seconds):
            context = _prepare_turn(room_id, event_id, lane)
            if context is None:
                return (
                    execute_room_turn(room_id, event_id, lane)
                    if lane
                    else execute_room_turn(room_id, event_id)
                )
            agent_lock = client.lock(
                f"ai-agora:room:{room_id}:agent:{context.agent_id}:turn",
                timeout=settings.room_turn_lock_seconds,
                thread_local=False,
            )
            if not agent_lock.acquire(blocking=False):
                raise RoomTurnBusy
            with renewed_lease(agent_lock, settings.room_turn_lock_seconds):
                return execute_room_turn(room_id, event_id, lane, prepared_context=context)
    finally:
        client.close()


def schedule_room_turn(
    room_id: str,
    trigger_event_id: str,
    *,
    countdown: int = 0,
    force: bool = False,
    lane: int | None = None,
    parent_event_id: str | None = None,
) -> bool:
    """Deux parcours bornés ; une relance humaine remplace les tâches encore en attente.

    Le pointeur Redis empêche une ancienne réponse de relancer un troisième parcours.
    Les événements PostgreSQL permettent de reconstruire chaque parcours après une panne.
    """
    if lane is None:
        return any(
            [
                schedule_room_turn(
                    room_id,
                    trigger_event_id,
                    countdown=countdown + slot * 2,
                    force=force,
                    lane=slot,
                )
                for slot in range(2)
            ]
        )
    settings = get_settings()
    with SessionLocal() as db:
        event = db.get(ConversationEvent, UUID(trigger_event_id))
        thread = event.payload.get("threadRootId") if event else None
    client = Redis.from_url(settings.redis_url)
    marker = f"ai-agora:room:{room_id}:scheduled:{trigger_event_id}:{lane}"
    pointer = f"ai-agora:room:{room_id}:thread:{thread or 'main'}:lane:{lane}:cursor"
    try:
        claimed = client.eval(
            """
            if ARGV[4] ~= '' and redis.call('GET', KEYS[2]) ~= ARGV[4] then return 0 end
            if ARGV[5] ~= '1' and redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
            redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
            redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
            return 1
        """,
            2,
            marker,
            pointer,
            str(time.time()),
            trigger_event_id,
            str(SCHEDULE_MARKER_TTL_SECONDS),
            parent_event_id or "",
            "1" if force else "0",
        )
        if not claimed:
            return False
        try:
            continue_room_turn.apply_async(
                args=[room_id, trigger_event_id, lane], countdown=max(0, countdown)
            )
        except (OperationalError, RedisError):
            client.delete(marker)
            raise
        return True
    finally:
        client.close()


@celery_app.task(
    bind=True,
    max_retries=None,
)
def continue_room_turn(self, room_id: str, trigger_event_id: str, lane: int = 0) -> dict[str, str]:  # type: ignore[no-untyped-def]
    """Laisse les participants échanger tant que la salle reste active."""

    room_uuid = UUID(room_id)
    event_uuid = UUID(trigger_event_id)
    try:
        with SessionLocal() as db:
            event = db.get(ConversationEvent, event_uuid)
            thread = event.payload.get("threadRootId") if event else None
        if event:
            client = Redis.from_url(get_settings().redis_url)
            try:
                pointer = cast(
                    bytes | str | None,
                    client.get(
                        f"ai-agora:room:{room_id}:thread:{thread or 'main'}:lane:{lane}:cursor"
                    ),
                )
                cursor = pointer.decode() if isinstance(pointer, bytes) else pointer
                if cursor and cursor != trigger_event_id:
                    return {"status": "superseded", "roomId": room_id}
            finally:
                client.close()
        result = (
            _execute_with_room_lock(room_uuid, event_uuid, lane)
            if lane
            else _execute_with_room_lock(room_uuid, event_uuid)
        )
    except (RoomTurnBusy, LocalProviderBusy) as exc:
        # La saturation est une attente normale, pas un message d'erreur dans la salle.
        raise self.retry(exc=exc, countdown=10, max_retries=None) from exc
    except ModelProviderError as exc:
        if exc.retryable and self.request.retries < 3:
            raise self.retry(exc=exc, countdown=2 ** (self.request.retries + 1)) from exc
        return record_room_failure(room_uuid, event_uuid, exc.code, lane)
    if result.get("status") == "completed" and int(result.get("chainDepth", "0")) % 8 == 0:
        refresh_room_memory.delay(room_id)
    if result.get("status") in {"completed", "already_completed"}:
        next_event_id = result.get("eventId")
        if next_event_id:
            try:
                schedule_room_turn(
                    room_id,
                    next_event_id,
                    countdown=conversation_delay(room_uuid),
                    lane=lane,
                    parent_event_id=trigger_event_id,
                )
            except (OperationalError, RedisError) as exc:
                raise self.retry(exc=exc, countdown=2 ** (self.request.retries + 1)) from exc
    return result


@celery_app.task
def recover_active_rooms() -> dict[str, int]:
    """Réconcilie les salles actives et les tâches perdues depuis les événements persistés."""

    settings = get_settings()
    client = Redis.from_url(settings.redis_url)
    scheduled = 0
    try:
        # Un seul balayage à la fois, même si deux planificateurs démarrent par erreur.
        lock = client.lock("ai-agora:recovery", timeout=60)
        if not lock.acquire(blocking=False):
            return {"scheduled": 0}
        try:
            now = datetime.now(timezone.utc)
            with SessionLocal() as db:
                rooms = db.scalars(select(Room).where(Room.status == RoomStatus.RUNNING)).all()
                for room in rooms:
                    started = room.started_at
                    if started and started.tzinfo is None:
                        started = started.replace(tzinfo=timezone.utc)
                    if room.amount_spent >= room.budget_limit or (
                        room.temporal_mode != "permanent"
                        and started
                        and now - started >= timedelta(minutes=room.max_duration_minutes)
                    ):
                        continue
                    if client.exists(f"ai-agora:room:{room.id}:turn"):
                        continue
                    latest_sequences = (
                        select(func.max(ConversationEvent.sequence))
                        .where(
                            ConversationEvent.room_id == room.id,
                            ConversationEvent.event_type.in_(["message.created", "agent.acted"]),
                        )
                        .group_by(
                            ConversationEvent.payload["threadRootId"].as_string(),
                            case(
                                (ConversationEvent.actor_agent_id.is_(None), -1),
                                else_=func.coalesce(
                                    ConversationEvent.payload["lane"].as_integer(), 0
                                ),
                            ),
                        )
                    )
                    events = db.scalars(
                        select(ConversationEvent).where(
                            ConversationEvent.room_id == room.id,
                            ConversationEvent.sequence.in_(latest_sequences),
                        )
                    ).all()
                    # Pour chaque parcours, retenir le plus récent entre son événement
                    # et la dernière intervention humaine du même fil.
                    groups: dict[str, dict[int, ConversationEvent]] = {}
                    for candidate in events:
                        thread = str(candidate.payload.get("threadRootId") or "main")
                        slot = (
                            int(candidate.payload.get("lane", 0))
                            if candidate.actor_agent_id
                            else -1
                        )
                        groups.setdefault(thread, {})[slot] = candidate
                    plans: list[tuple[ConversationEvent, int | None]] = []
                    for group in groups.values():
                        root = group.get(-1)
                        chosen = [
                            max([e for e in (root, group.get(slot)) if e], key=lambda e: e.sequence)
                            if root or group.get(slot)
                            else None
                            for slot in range(2)
                        ]
                        if chosen[0] is not None and chosen[0] == chosen[1]:
                            plans.append((chosen[0], None))
                        else:
                            plans.extend(
                                (event, slot) for slot, event in enumerate(chosen) if event
                            )
                    for event, lane in plans:
                        if not event:
                            continue
                        if (room.conversation_settings or {}).get(
                            "autonomy"
                        ) == "guided" and event.actor_agent_id:
                            continue
                        marker = cast(
                            bytes | str | None,
                            client.get(
                                f"ai-agora:room:{room.id}:scheduled:{event.id}:{lane if lane is not None else 0}"
                            ),
                        )
                        try:
                            age = time.time() - float(marker) if marker else float("inf")
                        except (ValueError, TypeError):
                            age = float("inf")  # Compatibilité avec l'ancien marqueur « 1 ».
                        if age < settings.room_recovery_stale_seconds:
                            continue
                        if schedule_room_turn(
                            str(room.id),
                            str(event.id),
                            force=True,
                            lane=lane,
                        ):
                            scheduled += 1
        finally:
            lock.release()
    finally:
        client.close()
    return {"scheduled": scheduled}


def conversation_delay(room_id: UUID) -> int:
    """La cadence concerne la pause ; la génération peut rester plus lente."""
    with SessionLocal() as db:
        room = db.get(Room, room_id)
        if not room:
            return get_settings().autonomous_turn_delay_seconds
        preferences = room.conversation_settings or {}
        delay = {"calm": 30, "normal": 10, "animated": 3}.get(preferences.get("pace", "normal"), 10)
        return delay * (2 if preferences.get("autonomy") == "balanced" else 1)


@celery_app.task(bind=True, max_retries=None)
def refresh_room_memory(self, room_id: str, force: bool = False) -> dict[str, str]:  # type: ignore[no-untyped-def]
    """Consolide la mémoire hors du chemin de publication d'un message."""

    settings = get_settings()
    client = Redis.from_url(settings.redis_url)
    lock = client.lock(
        f"ai-agora:room:{room_id}:turn", timeout=settings.room_turn_lock_seconds, thread_local=False
    )
    try:
        if not lock.acquire(blocking=False):
            raise self.retry(countdown=10)
        with renewed_lease(lock, settings.room_turn_lock_seconds):
            return refresh_memory(UUID(room_id), force=force)
    except LocalProviderBusy as exc:
        raise self.retry(exc=exc, countdown=10) from exc
    except ModelProviderError as exc:
        if exc.retryable and self.request.retries < 3:
            raise self.retry(exc=exc, countdown=15) from exc
        logger.warning(
            "La mémoire a conservé sa version précédente room_id=%s code=%s", room_id, exc.code
        )
        return {"status": "failed"}
    finally:
        client.close()
