"""Un fil garde sa cible malgré un nouveau message principal et reprend séparément."""

from contextlib import nullcontext
from uuid import UUID, uuid4

from sqlalchemy import select

from api.database import SessionLocal
from api.database.models import (
    AgentDefinition,
    ConversationEvent,
    Message,
    ProviderConnection,
    ProviderKind,
    Room,
    RoomParticipant,
    RoomStatus,
    User,
)
from api.services.events import append_room_event
from api.services.model_clients import ModelResult
from api.services.orchestration import _prepare_turn, execute_room_turn


def test_thread_isolation_attribution_and_generation(client, account, monkeypatch):
    with SessionLocal() as db:
        user = db.scalar(select(User))
        workspace_id = UUID(account["workspaceId"])
        provider = ProviderConnection(
            workspace_id=workspace_id, name="Local", kind=ProviderKind.LOCAL
        )
        room = Room(
            workspace_id=workspace_id,
            created_by_id=user.id,
            name="Fils",
            topic="Promenade",
            budget_limit=5,
            max_duration_minutes=60,
            status=RoomStatus.RUNNING,
        )
        db.add_all([provider, room])
        db.flush()
        agent = AgentDefinition(
            workspace_id=workspace_id,
            provider_id=provider.id,
            name="Alice",
            role="Organisatrice",
            model="mini",
            system_prompt="Tu es Alice.",
        )
        db.add(agent)
        db.flush()
        db.add(RoomParticipant(room_id=room.id, agent_id=agent.id))
        root = Message(
            room_id=room.id,
            author_agent_id=agent.id,
            content="Je propose dimanche.",
            idempotency_key="root",
        )
        db.add(root)
        db.flush()
        append_room_event(
            db, room.id, "message.created", {"messageId": str(root.id)}, actor_agent_id=agent.id
        )
        db.commit()
        room_id, root_id = room.id, root.id
    url = f"/api/v1/workspaces/{workspace_id}/rooms/{room_id}/messages"
    headers = {**account["headers"], "X-Idempotency-Key": "thread-message-001"}
    thread = client.post(
        url,
        headers=headers,
        json={
            "content": "@Alice À quelle heure dimanche ?",
            "threadRootId": str(root_id),
            "replyToId": str(root_id),
        },
    )
    assert thread.status_code == 201, thread.text
    thread_id = UUID(thread.json()["id"])
    assert thread.json()["threadRootId"] == str(root_id)
    with SessionLocal() as db:
        event_id = db.scalar(
            select(ConversationEvent.id).where(
                ConversationEvent.idempotency_key == "thread-message-001"
            )
        )
    main = client.post(
        url,
        headers={**headers, "X-Idempotency-Key": "main-message-001"},
        json={"content": "Parlons maintenant de vendredi."},
    )
    assert main.status_code == 201
    context = _prepare_turn(room_id, event_id)
    assert context and context.thread_root_id == root_id and context.trigger_message_id == thread_id
    assert "vendredi" not in str(context.messages)
    monkeypatch.setattr("api.services.orchestration.local_generation_slot", lambda _: nullcontext())
    monkeypatch.setattr(
        "api.services.orchestration.generate_model_response",
        lambda *_: ModelResult("Je propose neuf heures dimanche.", 40, 10),
    )
    assert execute_room_turn(room_id, event_id)["status"] == "completed"
    rows = client.get(
        url, headers=account["headers"], params={"thread_root_id": str(root_id)}
    ).json()["items"]
    assert len(rows) == 3
    assert rows[-1]["replyToId"] == str(thread_id)
    assert rows[-1]["threadRootId"] == str(root_id)
    assert len(client.get(url, headers=account["headers"]).json()["items"]) == 2
    assert (
        client.post(
            url,
            headers={**headers, "X-Idempotency-Key": "invalid-thread-01"},
            json={"content": "Réponse croisée", "replyToId": str(thread_id)},
        ).status_code
        == 422
    )
    assert (
        client.post(
            url,
            headers={**headers, "X-Idempotency-Key": "invalid-root-001"},
            json={"content": "Autre fil", "threadRootId": str(uuid4())},
        ).status_code
        == 422
    )

    class Lock:
        def acquire(self, **_):
            return True

        def release(self):
            pass

    class Redis:
        def lock(self, *_, **__):
            return Lock()

        def exists(self, *_):
            return False

        def get(self, *_):
            return None

        def close(self):
            pass

    scheduled = []
    monkeypatch.setattr("api.tasks.Redis.from_url", lambda _: Redis())
    monkeypatch.setattr(
        "api.tasks.schedule_room_turn", lambda room, event, **kw: scheduled.append(event) or True
    )
    from api.tasks import recover_active_rooms

    assert recover_active_rooms.run() == {"scheduled": 2}
    assert len(set(scheduled)) == 2
