"""Parcours métier complet du fournisseur jusqu'aux événements d'une arène."""

from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import select

from api.database import SessionLocal
from api.database.models import ProviderConnection


def _create_agent(
    client: TestClient,
    workspace_id: str,
    headers: dict[str, str],
    provider_id: str,
    name: str,
) -> dict:
    response = client.post(
        f"/api/v1/workspaces/{workspace_id}/agents",
        headers=headers,
        json={
            "name": name,
            "role": "Analyste critique",
            "providerId": provider_id,
            "model": "modele-test",
            "systemPrompt": "Analyse le problème avec rigueur et cite tes hypothèses.",
            "traits": {"creativite": 55, "espritCritique": 90},
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_secure_provider_and_idempotent_arena_flow(
    client: TestClient, account: dict[str, object]
) -> None:
    headers = account["headers"]
    workspace_id = account["workspaceId"]
    assert isinstance(headers, dict)
    assert isinstance(workspace_id, str)

    provider_response = client.post(
        f"/api/v1/workspaces/{workspace_id}/providers",
        headers=headers,
        json={
            "name": "Compatible local",
            "kind": "openai_compatible",
            "baseUrl": "https://models.example.test/v1",
            "apiKey": "secret-qui-ne-doit-jamais-sortir",
            "models": ["modele-test"],
            "capabilities": {"streaming": True},
        },
    )
    assert provider_response.status_code == 201, provider_response.text
    provider = provider_response.json()
    assert provider["hasApiKey"] is True
    assert "apiKey" not in provider
    assert "secret-qui-ne-doit-jamais-sortir" not in provider_response.text
    with SessionLocal() as session:
        stored_secret = session.scalar(
            select(ProviderConnection.encrypted_api_key).where(
                ProviderConnection.id == UUID(provider["id"])
            )
        )
    assert stored_secret
    assert stored_secret != "secret-qui-ne-doit-jamais-sortir"

    first = _create_agent(client, workspace_id, headers, provider["id"], "Socrate")
    second = _create_agent(client, workspace_id, headers, provider["id"], "Ada")
    room_payload = {
        "name": "Conseil architecture",
        "topic": "Choisir une architecture résiliente pour AI Agora",
        "budgetLimit": "12.5000",
        "maxMessages": 20,
        "maxDurationMinutes": 90,
        "participantIds": [first["id"], second["id"]],
    }
    command_headers = {**headers, "X-Idempotency-Key": "room-command-0001"}
    created = client.post(
        f"/api/v1/workspaces/{workspace_id}/rooms",
        headers=command_headers,
        json=room_payload,
    )
    assert created.status_code == 201, created.text
    room = created.json()
    replay = client.post(
        f"/api/v1/workspaces/{workspace_id}/rooms",
        headers=command_headers,
        json=room_payload,
    )
    assert replay.status_code == 201
    assert replay.json()["id"] == room["id"]

    started = client.patch(
        f"/api/v1/workspaces/{workspace_id}/rooms/{room['id']}/status",
        headers=headers,
        json={"status": "running", "expectedVersion": room["version"]},
    )
    assert started.status_code == 200, started.text
    assert started.json()["status"] == "running"

    message_headers = {**headers, "X-Idempotency-Key": "message-command-0001"}
    message = client.post(
        f"/api/v1/workspaces/{workspace_id}/rooms/{room['id']}/messages",
        headers=message_headers,
        json={"content": "Quelles contraintes devons-nous traiter en premier ?"},
    )
    assert message.status_code == 201, message.text
    replayed_message = client.post(
        f"/api/v1/workspaces/{workspace_id}/rooms/{room['id']}/messages",
        headers=message_headers,
        json={"content": "Ce contenu différent ne doit pas créer un doublon."},
    )
    assert replayed_message.json()["id"] == message.json()["id"]

    reaction = client.put(
        f"/api/v1/workspaces/{workspace_id}/rooms/{room['id']}/messages/{message.json()['id']}/reactions/🎯",
        headers=headers,
        json={"present": True},
    )
    assert reaction.status_code == 200, reaction.text
    assert reaction.json()["reactions"] == [{"emoji": "🎯", "count": 1, "reactedByMe": True}]

    events = client.get(
        f"/api/v1/workspaces/{workspace_id}/rooms/{room['id']}/events",
        headers=headers,
    )
    cursors = [int(event["cursor"]) for event in events.json()["items"]]
    assert cursors == sorted(cursors)
    assert len(cursors) == len(set(cursors))
    assert {event["payload"]["type"] for event in events.json()["items"]} >= {
        "room.created",
        "room.running",
        "message.created",
        "reaction.updated",
    }


def test_workspace_isolation_hides_foreign_resources(
    client: TestClient, account: dict[str, object]
) -> None:
    first_headers = account["headers"]
    first_workspace = account["workspaceId"]
    assert isinstance(first_headers, dict)
    assert isinstance(first_workspace, str)
    second = client.post(
        "/api/v1/auth/register",
        json={
            "email": "intrus@agora.example.com",
            "username": "intrus",
            "password": "AutrePhraseSecrete2026!",
        },
    ).json()
    foreign_headers = {"Authorization": f"Bearer {second['accessToken']}"}
    response = client.get(f"/api/v1/workspaces/{first_workspace}/agents", headers=foreign_headers)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "workspace_not_found"
