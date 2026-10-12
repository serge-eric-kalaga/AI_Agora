"""Tâches asynchrones; l'orchestrateur de modèles sera branché sur ce contrat."""

from uuid import UUID

from api.celery_app import celery_app


@celery_app.task(bind=True, autoretry_for=(ConnectionError,), retry_backoff=True, max_retries=5)
def continue_room_turn(self, room_id: str, trigger_event_id: str) -> dict[str, str]:  # type: ignore[no-untyped-def]
    """Réserve le contrat de la future prise de parole asynchrone d'un agent."""

    UUID(room_id)
    UUID(trigger_event_id)
    return {"status": "reserved", "roomId": room_id, "triggerEventId": trigger_event_id}
