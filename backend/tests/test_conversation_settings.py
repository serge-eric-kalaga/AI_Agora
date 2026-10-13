"""Réglages persistants, permissions et autonomie guidée."""

from uuid import UUID

import pytest
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
    WorkspaceMember,
    WorkspaceRole,
)
from api.services.orchestration import _prepare_turn
from api.tasks import conversation_delay


@pytest.mark.parametrize(
    "pace,autonomy,delay",
    [("calm", "free", 30), ("normal", "balanced", 20), ("animated", "guided", 3)],
)
def test_settings_version_permissions_and_guided_turn(client, account, pace, autonomy, delay):
    workspace_id = UUID(account["workspaceId"])
    with SessionLocal() as db:
        user = db.scalar(select(User))
        room = Room(
            workspace_id=workspace_id,
            created_by_id=user.id,
            name="Cadence",
            topic="Promenade",
            budget_limit=5,
            max_duration_minutes=60,
            status=RoomStatus.RUNNING,
            next_event_sequence=2,
        )
        provider = ProviderConnection(
            workspace_id=workspace_id, name="Local", kind=ProviderKind.LOCAL
        )
        db.add_all([room, provider])
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
        message = Message(
            room_id=room.id,
            author_agent_id=agent.id,
            content="Je propose dimanche.",
            idempotency_key="initial",
        )
        db.add(message)
        db.flush()
        event = ConversationEvent(
            room_id=room.id,
            sequence=1,
            event_type="message.created",
            actor_agent_id=agent.id,
            payload={"messageId": str(message.id)},
        )
        db.add(event)
        db.commit()
        room_id, event_id = room.id, event.id
    url = f"/api/v1/workspaces/{workspace_id}/rooms/{room_id}/conversation-settings"
    payload = {"pace": pace, "autonomy": autonomy, "responseLength": "brief", "expectedVersion": 1}
    response = client.patch(url, headers=account["headers"], json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["conversationSettings"]["autonomy"] == autonomy
    assert response.json()["version"] == 2
    assert conversation_delay(room_id) == delay
    # Les paramètres métier et les préférences sont mis à jour ensemble et diffusés.
    changed = client.patch(
        url,
        headers=account["headers"],
        json={
            **payload,
            "expectedVersion": 2,
            "name": "Nouveau nom",
            "topic": "Nouveau sujet",
            "rules": "Répondre simplement",
            "budgetLimit": 7,
            "maxDurationMinutes": 120,
        },
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["name"] == "Nouveau nom"
    assert changed.json()["topic"] == "Nouveau sujet"
    assert changed.json()["maxDurationMinutes"] == 120
    assert set(changed.json()["conversationSettings"]) == {"pace", "autonomy", "responseLength"}
    with SessionLocal() as db:
        saved = db.get(Room, room_id)
        assert saved.version == 3
        assert (
            db.scalar(
                select(ConversationEvent).where(
                    ConversationEvent.room_id == room_id,
                    ConversationEvent.event_type == "room.settings.updated",
                    ConversationEvent.sequence == 3,
                )
            )
            is not None
        )
    assert client.patch(url, headers=account["headers"], json=payload).status_code == 409
    assert (_prepare_turn(room_id, event_id) is None) == (autonomy == "guided")
    with SessionLocal() as db:
        membership = db.scalar(
            select(WorkspaceMember).where(WorkspaceMember.workspace_id == workspace_id)
        )
        membership.role = WorkspaceRole.OBSERVER
        db.commit()
    payload["expectedVersion"] = 3
    assert client.patch(url, headers=account["headers"], json=payload).status_code == 403
