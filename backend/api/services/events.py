"""Production d'événements strictement ordonnés à l'intérieur d'une arène."""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from api.database.models import ConversationEvent, Room
from api.errors import NotFoundError


def append_room_event(
    db: Session,
    room_id: UUID,
    event_type: str,
    payload: dict[str, Any],
    *,
    actor_user_id: UUID | None = None,
    actor_agent_id: UUID | None = None,
    idempotency_key: str | None = None,
) -> ConversationEvent:
    """Verrouille l'arène pour réserver une séquence sans collision."""

    room = db.scalar(select(Room).where(Room.id == room_id).with_for_update())
    if not room:
        raise NotFoundError("room_not_found", "L'arène demandée est introuvable.")
    event = ConversationEvent(
        room_id=room.id,
        sequence=room.next_event_sequence,
        event_type=event_type,
        actor_user_id=actor_user_id,
        actor_agent_id=actor_agent_id,
        payload={"type": event_type, **payload},
        idempotency_key=idempotency_key,
    )
    room.next_event_sequence += 1
    db.add(event)
    return event
