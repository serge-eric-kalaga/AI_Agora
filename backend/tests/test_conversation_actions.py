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


def test_independent_replies_keep_their_target_and_quoted_author(client, account, monkeypatch):
    """Deux agents répondent au même humain même si une autre réponse arrive entretemps."""
    with SessionLocal() as db:
        user = db.scalar(select(User))
        provider = ProviderConnection(
            workspace_id=user.memberships[0].workspace_id, name="Local", kind=ProviderKind.LOCAL
        )
        db.add(provider)
        db.flush()
        room = Room(
            workspace_id=provider.workspace_id,
            created_by_id=user.id,
            name="Libre",
            topic="Organiser une sortie",
            status=RoomStatus.RUNNING,
            budget_limit=5,
            max_duration_minutes=60,
        )
        db.add(room)
        db.flush()
        for name in ("Alice", "Benoît"):
            agent = AgentDefinition(
                workspace_id=provider.workspace_id,
                provider_id=provider.id,
                name=name,
                role="Participant",
                model="mini",
                system_prompt=f"Tu es {name}.",
            )
            db.add(agent)
            db.flush()
            db.add(RoomParticipant(room_id=room.id, agent_id=agent.id))
        root = Message(
            room_id=room.id,
            author_user_id=user.id,
            content="Qui vient dimanche ?",
            idempotency_key="question-commune",
        )
        db.add(root)
        db.flush()
        event = append_room_event(
            db, room.id, "message.created", {"messageId": str(root.id)}, actor_user_id=user.id
        )
        db.commit()
        rid, eid, mid, wid = room.id, event.id, root.id, room.workspace_id
    first, second = _prepare_turn(rid, eid, 0), _prepare_turn(rid, eid, 1)
    assert first.agent_id != second.agent_id
    assert first.trigger_message_id == second.trigger_message_id == mid
    monkeypatch.setattr("api.services.orchestration.local_generation_slot", lambda _: nullcontext())
    monkeypatch.setattr(
        "api.services.orchestration.generate_model_response",
        lambda *_: ModelResult("Oui, je viens.", 12, 5),
    )
    assert execute_room_turn(rid, eid, 0, prepared_context=first)["status"] == "completed"
    retried_second = _prepare_turn(rid, eid, 1)
    assert retried_second.agent_id == second.agent_id
    assert retried_second.trigger_message_id == mid
    assert execute_room_turn(rid, eid, 1, prepared_context=retried_second)["status"] == "completed"
    assert execute_room_turn(rid, eid, 1)["status"] == "already_completed"
    page = client.get(
        f"/api/v1/workspaces/{wid}/rooms/{rid}/messages?limit=1", headers=account["headers"]
    ).json()
    # Le message cité n’est pas dans cette page mais son auteur et son texte sont visibles.
    quoted = page["items"][0]
    assert quoted["replyToId"] == str(mid)
    assert quoted["replyAuthorName"] == account["user"]["username"]
    assert quoted["replyAuthorIsMe"] is True
    assert quoted["replyExcerpt"] == "Qui vient dimanche ?"

    room_stats = client.get(
        f"/api/v1/workspaces/{wid}/rooms/{rid}", headers=account["headers"]
    ).json()
    assert room_stats["messageCount"] == 3
    assert room_stats["lastMessageAt"] is not None
    collection = client.get(f"/api/v1/workspaces/{wid}/rooms", headers=account["headers"]).json()
    assert next(r for r in collection["items"] if r["id"] == str(rid))["messageCount"] == 3
