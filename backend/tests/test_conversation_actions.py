"""Actions autonomes durables, silencieuses et sans doublon."""

import json
from contextlib import nullcontext
from datetime import timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from api.database import SessionLocal
from api.database.models import (
    AgentDefinition,
    Message,
    MessageReaction,
    ProviderConnection,
    ProviderKind,
    Room,
    RoomParticipant,
    RoomStatus,
    User,
    utcnow,
)
from api.services.events import append_room_event
from api.services.model_clients import ModelProviderError, ModelResult
from api.services.orchestration import _prepare_turn, execute_room_turn


@pytest.mark.parametrize("action", ["reaction", "silence", "initiative"])
def test_agent_action_persists_and_resumes(client, account, monkeypatch, action):
    with SessionLocal() as db:
        user = db.scalar(select(User))
        provider = ProviderConnection(
            workspace_id=user.memberships[0].workspace_id, name="Mini", kind=ProviderKind.LOCAL
        )
        db.add(provider)
        db.flush()
        room = Room(
            workspace_id=provider.workspace_id,
            created_by_id=user.id,
            name="Actions",
            topic="Promenade",
            status=RoomStatus.RUNNING,
            budget_limit=5,
            max_duration_minutes=60,
        )
        db.add(room)
        db.flush()
        a = AgentDefinition(
            workspace_id=provider.workspace_id,
            provider_id=provider.id,
            name="Alice",
            role="Organisatrice",
            model="mini",
            system_prompt="Tu es Alice.",
        )
        b = AgentDefinition(
            workspace_id=provider.workspace_id,
            provider_id=provider.id,
            name="Benoît",
            role="Participant",
            model="mini",
            system_prompt="Tu es Benoît.",
        )
        db.add_all([a, b])
        db.flush()
        db.add_all(
            [
                RoomParticipant(room_id=room.id, agent_id=a.id),
                RoomParticipant(room_id=room.id, agent_id=b.id),
            ]
        )
        root = Message(
            room_id=room.id,
            author_agent_id=a.id,
            content="Dimanche à neuf heures.",
            idempotency_key=str(uuid4()),
        )
        db.add(root)
        db.flush()
        event = append_room_event(
            db, room.id, "message.created", {"messageId": str(root.id)}, actor_agent_id=a.id
        )
        db.commit()
        rid, eid, bid = room.id, event.id, b.id
    monkeypatch.setattr("api.services.orchestration.local_generation_slot", lambda _: nullcontext())
    monkeypatch.setattr(
        "api.services.orchestration.generate_model_response",
        lambda *_: ModelResult(
            json.dumps(
                {
                    "action": action,
                    "content": "Pensons aussi à apporter de l’eau."
                    if action == "initiative"
                    else "",
                    "emoji": "👍" if action == "reaction" else None,
                }
            ),
            30,
            10,
        ),
    )
    result = execute_room_turn(rid, eid)
    assert result["status"] == "completed"
    assert execute_room_turn(rid, eid)["status"] == "already_completed"
    with SessionLocal() as db:
        assert len(db.scalars(select(Message).where(Message.room_id == rid)).all()) == (
            2 if action == "initiative" else 1
        )
        assert len(db.scalars(select(MessageReaction)).all()) == (1 if action == "reaction" else 0)
        room = db.get(Room, rid)
        assert room.local_tokens == 40
    next_context = _prepare_turn(rid, __import__("uuid").UUID(result["eventId"]))
    assert next_context and next_context.agent_id != bid
    with SessionLocal() as db:
        room = db.get(Room, rid)
        room.started_at = utcnow() - timedelta(days=1)
        db.commit()
    assert _prepare_turn(rid, UUID(result["eventId"])) is None
    with SessionLocal() as db:
        room = db.get(Room, rid)
        from api.database.models import TemporalMode

        room.temporal_mode = TemporalMode.PERMANENT
        db.commit()
    assert _prepare_turn(rid, UUID(result["eventId"])) is not None


def test_invalid_action_is_not_a_partial_message(monkeypatch):
    from api.services.conversation_actions import choose_action
    from api.services.model_clients import ModelRequest

    provider = ProviderConnection(name="Local", kind=ProviderKind.LOCAL)
    with pytest.raises(ModelProviderError):
        choose_action(
            provider,
            ModelRequest("mini", "Identité", []),
            lambda *_: ModelResult('{"action":', 10, 4, True),
        )
