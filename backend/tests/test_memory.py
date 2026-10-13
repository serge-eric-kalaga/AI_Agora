"""Attribution de la mémoire, références, consolidation et isolation de l'API."""

from contextlib import nullcontext
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from api.database import SessionLocal
from api.database.models import (
    AgentDefinition,
    Message,
    ProviderConnection,
    ProviderKind,
    Room,
    RoomMemory,
    User,
)
from api.schemas.memory import MemoryEntry, MemoryState
from api.services.conversation_memory import InvalidMemory, refresh_memory, validate_memory
from api.services.model_clients import ModelProviderError, ModelResult


@pytest.mark.parametrize("case", ["foreign_message", "wrong_author", "invented_agreement"])
def test_memory_rejects_untraceable_entries(case):
    agent_id, message_id = uuid4(), uuid4()
    source = Message(id=message_id, author_agent_id=agent_id, content="Je propose une pause.")
    entry = MemoryEntry(
        kind="position",
        text="Propose une pause.",
        message_ids=[message_id],
        author_agent_ids=[agent_id],
    )
    if case == "foreign_message":
        entry.message_ids = [uuid4()]
    elif case == "wrong_author":
        entry.author_agent_ids = [uuid4()]
    else:
        entry.kind = "accord"
    with pytest.raises(InvalidMemory):
        validate_memory(MemoryState(entries=[entry]), {message_id: source})


def test_memory_update_and_read_are_attributed_and_isolated(client, account, monkeypatch):
    with SessionLocal() as db:
        workspace_id = UUID(account["workspaceId"])
        owner_id = db.scalar(select(User.id))
        provider = ProviderConnection(
            workspace_id=workspace_id,
            name="Local mémoire",
            kind=ProviderKind.LOCAL,
            base_url="http://ollama.test:11434",
        )
        db.add(provider)
        db.flush()
        agent = AgentDefinition(
            workspace_id=workspace_id,
            provider_id=provider.id,
            name="Ariane",
            role="Analyste",
            model="mini",
            system_prompt="Profil stable",
        )
        db.add(agent)
        room = Room(
            workspace_id=workspace_id,
            created_by_id=owner_id,
            name="Mémoire",
            topic="Conserver des positions attribuées",
            budget_limit=5,
            max_duration_minutes=60,
        )
        db.add(room)
        db.flush()
        messages = [
            Message(
                room_id=room.id,
                author_agent_id=agent.id,
                content=f"Position {index}",
                idempotency_key=f"message-{index}",
            )
            for index in range(8)
        ]
        db.add_all(messages)
        db.commit()
        room_id, agent_id, first_id = room.id, agent.id, messages[0].id
    content = MemoryState(
        entries=[
            MemoryEntry(
                kind="position",
                text="Position initiale",
                message_ids=[first_id],
                author_agent_ids=[agent_id],
            )
        ]
    )
    content.entries.append(
        MemoryEntry(
            kind="accord",
            text="Accord non démontré",
            message_ids=[first_id],
            author_agent_ids=[agent_id],
        )
    )
    monkeypatch.setattr(
        "api.services.conversation_memory.local_generation_slot", lambda _: nullcontext()
    )
    monkeypatch.setattr(
        "api.services.conversation_memory.generate_model_response",
        lambda *_: ModelResult(content.model_dump_json(), 100, 40),
    )
    assert refresh_memory(room_id) == {"status": "updated", "revision": "1"}
    assert refresh_memory(room_id) == {"status": "unchanged"}
    url = f"/api/v1/workspaces/{workspace_id}/rooms/{room_id}/memory"
    response = client.get(url, headers=account["headers"])
    assert response.status_code == 200
    assert response.json()["entries"][0]["messageIds"] == [str(first_id)]
    assert response.json()["entries"][0]["authorAgentIds"] == [str(agent_id)]
    assert response.json()["revision"] == 1
    assert len(response.json()["entries"]) == 1
    with SessionLocal() as db:
        assert db.get(Room, room_id).local_tokens == 140
        db.add(
            Message(
                room_id=room_id,
                author_agent_id=agent_id,
                content="Nouvelle position",
                idempotency_key="next",
            )
        )
        db.commit()
    monkeypatch.setattr(
        "api.services.conversation_memory.generate_model_response",
        lambda *_: ModelResult("texte invalide", 10, 3),
    )
    with pytest.raises(ModelProviderError):
        refresh_memory(room_id, force=True)
    with SessionLocal() as db:
        assert db.get(RoomMemory, room_id).revision == 1
        assert db.get(Room, room_id).local_tokens == 153
    other = client.post(
        "/api/v1/auth/register",
        json={
            "email": "autre@agora.example.com",
            "username": "autre",
            "password": "UnePhraseSecrete2026!",
        },
    ).json()
    assert (
        client.get(url, headers={"Authorization": f"Bearer {other['accessToken']}"}).status_code
        == 404
    )
    assert (
        client.get(
            f"/api/v1/workspaces/{uuid4()}/rooms/{room_id}/memory", headers=account["headers"]
        ).status_code
        == 404
    )
