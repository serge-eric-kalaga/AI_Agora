"""Tâches asynchrones d'orchestration des agents."""

from uuid import UUID

from api.celery_app import celery_app
from api.services.model_clients import ModelProviderError
from api.services.orchestration import execute_room_turn


@celery_app.task(
    bind=True,
    autoretry_for=(ConnectionError, ModelProviderError),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=3,
)
def continue_room_turn(self, room_id: str, trigger_event_id: str) -> dict[str, str]:  # type: ignore[no-untyped-def]
    """Produit une réponse d'agent idempotente à partir d'un message humain."""

    return execute_room_turn(UUID(room_id), UUID(trigger_event_id))
