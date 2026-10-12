"""Tâches asynchrones d'orchestration des agents."""

from uuid import UUID

from celery.exceptions import OperationalError

from api.celery_app import celery_app
from api.configs import get_settings
from api.services.model_clients import ModelProviderError
from api.services.orchestration import execute_room_turn, record_room_failure


@celery_app.task(
    bind=True,
    max_retries=3,
)
def continue_room_turn(self, room_id: str, trigger_event_id: str) -> dict[str, str]:  # type: ignore[no-untyped-def]
    """Produit une chaîne bornée de réponses avec retries et erreur visible."""

    room_uuid = UUID(room_id)
    event_uuid = UUID(trigger_event_id)
    try:
        result = execute_room_turn(room_uuid, event_uuid)
    except ModelProviderError as exc:
        if exc.retryable and self.request.retries < 3:
            raise self.retry(exc=exc, countdown=2 ** (self.request.retries + 1)) from exc
        return record_room_failure(room_uuid, event_uuid, exc.code)
    if result.get("status") in {"completed", "already_completed"}:
        depth = int(result.get("chainDepth", "0"))
        next_event_id = result.get("eventId")
        if next_event_id and depth < get_settings().max_agent_turns_per_trigger:
            try:
                continue_room_turn.delay(room_id, next_event_id)
            except OperationalError as exc:
                raise self.retry(exc=exc, countdown=2 ** (self.request.retries + 1)) from exc
    return result
