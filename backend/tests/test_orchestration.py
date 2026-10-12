"""Validation des fournisseurs et du tour d'agent sans appel externe."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from api.database import SessionLocal
from api.database.models import (
    ConversationEvent,
    Message,
    MessageKind,
    ProviderConnection,
    ProviderKind,
    Room,
)
from api.services.model_clients import (
    ModelProviderError,
    ModelRequest,
    ModelResult,
    generate_model_response,
)
from api.services.orchestration import execute_room_turn, record_room_failure
from api.tasks import RoomTurnBusy, _execute_with_room_lock


def _agent_payload(provider_id: str, name: str) -> dict[str, object]:
    return {
        "name": name,
        "role": "Analyste produit",
        "providerId": provider_id,
        "model": "qwen3.5:4b",
        "systemPrompt": "Analyse la demande avec rigueur et propose une décision claire.",
        "generationConfig": {"temperature": 0.2, "maxTokens": 256},
    }


def test_local_turn_is_idempotent_and_accounts_for_tokens(
    client: TestClient, account: dict[str, object], monkeypatch
) -> None:
    headers = account["headers"]
    workspace_id = account["workspaceId"]
    assert isinstance(headers, dict)
    assert isinstance(workspace_id, str)
    provider = client.post(
        f"/api/v1/workspaces/{workspace_id}/providers",
        headers=headers,
        json={
            "name": "Ollama test",
            "kind": "local",
            "baseUrl": "http://host.docker.internal:11434",
            "models": ["qwen3.5:4b"],
        },
    ).json()
    agents = [
        client.post(
            f"/api/v1/workspaces/{workspace_id}/agents",
            headers=headers,
            json=_agent_payload(provider["id"], name),
        ).json()
        for name in ("Mini A", "Mini B")
    ]
    room = client.post(
        f"/api/v1/workspaces/{workspace_id}/rooms",
        headers={**headers, "X-Idempotency-Key": "room-local-turn-0001"},
        json={
            "name": "Salle locale",
            "topic": "Prioriser le prochain incrément produit",
            "budgetLimit": "1.0000",
            "participantIds": [agent["id"] for agent in agents],
        },
    ).json()
    room = client.patch(
        f"/api/v1/workspaces/{workspace_id}/rooms/{room['id']}/status",
        headers=headers,
        json={"status": "running", "expectedVersion": room["version"]},
    ).json()
    message_response = client.post(
        f"/api/v1/workspaces/{workspace_id}/rooms/{room['id']}/messages",
        headers={**headers, "X-Idempotency-Key": "human-local-turn-0001"},
        json={"content": "@Mini B, quelle priorité recommandes-tu ?"},
    )
    assert message_response.status_code == 201, message_response.text
    with SessionLocal() as db:
        event_id = db.scalar(
            select(ConversationEvent.id).where(
                ConversationEvent.room_id == UUID(room["id"]),
                ConversationEvent.event_type == "message.created",
            ).order_by(ConversationEvent.sequence.desc())
        )
    assert event_id
    requests: list[ModelRequest] = []

    def fake_generation(provider, request: ModelRequest) -> ModelResult:
        requests.append(request)
        return ModelResult("Je recommande de sécuriser le flux temps réel.", 30, 12)

    monkeypatch.setattr("api.services.orchestration.generate_model_response", fake_generation)

    result = execute_room_turn(UUID(room["id"]), event_id)
    followup = execute_room_turn(UUID(room["id"]), UUID(result["eventId"]))
    replay = execute_room_turn(UUID(room["id"]), event_id)

    assert result["status"] == "completed"
    assert followup["status"] == "completed"
    assert replay["status"] == "already_completed"
    assert requests[0].messages[-1]["role"] == "user"
    assert requests[1].messages[-1]["role"] == "user"
    assert requests[1].messages[-1]["content"].startswith("Mini B:")
    with SessionLocal() as db:
        stored_room = db.get(Room, UUID(room["id"]))
        agent_messages = db.scalar(
            select(func.count(Message.id)).where(
                Message.room_id == UUID(room["id"]), Message.author_agent_id.is_not(None)
            )
        )
        assert stored_room
        assert agent_messages == 2
        generated = db.scalars(
            select(Message).where(
                Message.room_id == UUID(room["id"]), Message.author_agent_id.is_not(None)
            )
        ).all()
        assert {str(message.author_agent_id) for message in generated} == {
            agents[0]["id"],
            agents[1]["id"],
        }
        assert stored_room.local_tokens == 84
        assert stored_room.cloud_tokens == 0
        assert stored_room.amount_spent == 0

    failure_trigger = uuid4()
    first_failure = record_room_failure(UUID(room["id"]), failure_trigger, "model_not_found")
    replayed_failure = record_room_failure(UUID(room["id"]), failure_trigger, "model_not_found")
    assert first_failure["messageId"] == replayed_failure["messageId"]
    with SessionLocal() as db:
        failures = db.scalar(
            select(func.count(Message.id)).where(
                Message.room_id == UUID(room["id"]), Message.kind == MessageKind.SYSTEM
            )
        )
    assert failures == 1


def test_ollama_request_disables_hidden_reasoning(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "message": {"content": "Réponse locale"},
                "prompt_eval_count": 8,
                "eval_count": 3,
            }

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *args) -> None:
            return None

        def post(self, url: str, **kwargs) -> FakeResponse:
            captured.update(url=url, **kwargs)
            return FakeResponse()

    monkeypatch.setattr("api.services.model_clients.httpx.Client", lambda **kwargs: FakeClient())
    monkeypatch.setattr("api.services.model_clients._validate_destination", lambda url: None)
    provider = ProviderConnection(
        kind=ProviderKind.LOCAL,
        base_url="http://ollama.test:11434",
        encrypted_api_key=None,
    )

    result = generate_model_response(
        provider,
        ModelRequest("qwen3.5:4b", "Réponds brièvement.", [{"role": "user", "content": "Test"}]),
    )

    assert result.content == "Réponse locale"
    payload = captured["json"]
    assert isinstance(payload, dict)
    assert payload["think"] is False


def test_empty_ollama_response_is_retryable(monkeypatch) -> None:
    """Une réponse vide transitoire doit laisser Celery relancer le tour."""

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {"message": {"content": ""}, "done_reason": "stop"}

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *args) -> None:
            return None

        def post(self, url: str, **kwargs) -> FakeResponse:
            return FakeResponse()

    monkeypatch.setattr("api.services.model_clients.httpx.Client", lambda **kwargs: FakeClient())
    monkeypatch.setattr("api.services.model_clients._validate_destination", lambda url: None)
    provider = ProviderConnection(
        kind=ProviderKind.LOCAL,
        base_url="http://ollama.test:11434",
        encrypted_api_key=None,
    )

    with pytest.raises(ModelProviderError) as error:
        generate_model_response(
            provider,
            ModelRequest("qwen3.5:4b", "Réponds brièvement.", [{"role": "user", "content": "Test"}]),
        )

    assert error.value.code == "empty_model_response"
    assert error.value.retryable is True


def test_room_turn_lock_releases_after_generation(monkeypatch) -> None:
    """Le verrou Redis est toujours libéré après le tour sérialisé."""

    state = {"released": False, "closed": False}

    class FakeLock:
        def acquire(self, **_kwargs) -> bool:
            return True

        def release(self) -> None:
            state["released"] = True

    class FakeRedis:
        def lock(self, *_args, **_kwargs) -> FakeLock:
            return FakeLock()

        def close(self) -> None:
            state["closed"] = True

    monkeypatch.setattr("api.tasks.Redis.from_url", lambda _url: FakeRedis())
    monkeypatch.setattr(
        "api.tasks.execute_room_turn",
        lambda room_id, event_id: {"status": "completed", "roomId": str(room_id)},
    )

    result = _execute_with_room_lock(uuid4(), uuid4())

    assert result["status"] == "completed"
    assert state == {"released": True, "closed": True}


def test_room_turn_lock_rejects_concurrent_generation(monkeypatch) -> None:
    """Un worker concurrent doit repasser par le mécanisme de retry Celery."""

    class FakeLock:
        def acquire(self, **_kwargs) -> bool:
            return False

    class FakeRedis:
        def lock(self, *_args, **_kwargs) -> FakeLock:
            return FakeLock()

        def close(self) -> None:
            return None

    monkeypatch.setattr("api.tasks.Redis.from_url", lambda _url: FakeRedis())

    with pytest.raises(RoomTurnBusy):
        _execute_with_room_lock(uuid4(), uuid4())


def test_provider_diagnostic_refreshes_discovered_models(
    client: TestClient, account: dict[str, object], monkeypatch
) -> None:
    headers = account["headers"]
    workspace_id = account["workspaceId"]
    assert isinstance(headers, dict)
    assert isinstance(workspace_id, str)
    provider = client.post(
        f"/api/v1/workspaces/{workspace_id}/providers",
        headers=headers,
        json={
            "name": "Ollama diagnostic",
            "kind": "local",
            "baseUrl": "http://host.docker.internal:11434",
            "models": ["ancien-modele"],
        },
    ).json()

    async def fake_test_provider(connection):
        return True, "Connexion locale réussie.", ["qwen3.5:4b"], datetime.now(timezone.utc)

    monkeypatch.setattr("api.views.providers.test_provider", fake_test_provider)
    response = client.post(
        f"/api/v1/workspaces/{workspace_id}/providers/{provider['id']}/test",
        headers=headers,
    )

    assert response.status_code == 200, response.text
    assert response.json()["modelsDiscovered"] == ["qwen3.5:4b"]
    items = client.get(f"/api/v1/workspaces/{workspace_id}/providers", headers=headers).json()[
        "items"
    ]
    refreshed = next(item for item in items if item["id"] == provider["id"])
    assert refreshed["models"] == ["qwen3.5:4b"]
