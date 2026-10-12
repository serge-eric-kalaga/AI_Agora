"""Tâches asynchrones d'orchestration des agents."""

import logging
from uuid import UUID

from celery.exceptions import OperationalError
from redis import Redis
from redis.exceptions import LockNotOwnedError, RedisError

from api.celery_app import celery_app
from api.configs import get_settings
from api.services.model_clients import ModelProviderError
from api.services.orchestration import execute_room_turn, record_room_failure

logger = logging.getLogger(__name__)
SCHEDULE_MARKER_TTL_SECONDS = 7 * 24 * 60 * 60


class RoomTurnBusy(RuntimeError):
    """Indique qu'un autre worker orchestre déjà cette salle."""


def _execute_with_room_lock(room_id: UUID, event_id: UUID) -> dict[str, str]:
    """Sérialise les générations d'une salle avec un verrou Redis expirant."""

    settings = get_settings()
    client = Redis.from_url(settings.redis_url)
    lock = client.lock(
        f"ai-agora:room:{room_id}:turn",
        timeout=settings.room_turn_lock_seconds,
    )
    acquired = lock.acquire(blocking=True, blocking_timeout=1)
    if not acquired:
        client.close()
        raise RoomTurnBusy
    try:
        return execute_room_turn(room_id, event_id)
    finally:
        try:
            lock.release()
        except LockNotOwnedError:
            logger.warning("Le verrou du tour a expiré avant sa libération room_id=%s", room_id)
        client.close()


def schedule_room_turn(
    room_id: str, trigger_event_id: str, *, countdown: int = 0, force: bool = False
) -> bool:
    """Planifie un seul tour par événement, même en cas de retry ou de double clic."""

    settings = get_settings()
    client = Redis.from_url(settings.redis_url)
    marker = f"ai-agora:room:{room_id}:scheduled:{trigger_event_id}"
    try:
        if force:
            client.set(marker, "1", ex=SCHEDULE_MARKER_TTL_SECONDS)
            claimed = True
        else:
            claimed = bool(
                client.set(marker, "1", nx=True, ex=SCHEDULE_MARKER_TTL_SECONDS)
            )
        if not claimed:
            return False
        try:
            continue_room_turn.apply_async(
                args=[room_id, trigger_event_id], countdown=max(0, countdown)
            )
        except (OperationalError, RedisError):
            client.delete(marker)
            raise
        return True
    finally:
        client.close()


@celery_app.task(
    bind=True,
    max_retries=8,
)
def continue_room_turn(self, room_id: str, trigger_event_id: str) -> dict[str, str]:  # type: ignore[no-untyped-def]
    """Laisse les participants échanger tant que la salle reste active."""

    room_uuid = UUID(room_id)
    event_uuid = UUID(trigger_event_id)
    try:
        result = _execute_with_room_lock(room_uuid, event_uuid)
    except RoomTurnBusy as exc:
        if self.request.retries < 8:
            raise self.retry(exc=exc, countdown=min(2 ** (self.request.retries + 1), 10)) from exc
        return record_room_failure(room_uuid, event_uuid, "room_turn_busy")
    except ModelProviderError as exc:
        if exc.retryable and self.request.retries < 3:
            raise self.retry(exc=exc, countdown=2 ** (self.request.retries + 1)) from exc
        return record_room_failure(room_uuid, event_uuid, exc.code)
    if result.get("status") in {"completed", "already_completed"}:
        next_event_id = result.get("eventId")
        if next_event_id:
            try:
                schedule_room_turn(
                    room_id,
                    next_event_id,
                    countdown=get_settings().autonomous_turn_delay_seconds,
                )
            except (OperationalError, RedisError) as exc:
                raise self.retry(exc=exc, countdown=2 ** (self.request.retries + 1)) from exc
    return result
