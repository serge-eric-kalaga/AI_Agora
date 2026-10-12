"""Contrats d'authentification et qualité de la documentation OpenAPI."""

from fastapi.testclient import TestClient


def test_registration_login_and_protected_profile(client: TestClient) -> None:
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "email": "explorateur@agora.example.com",
            "username": "explorateur",
            "password": "MotDePasseSolide2026!",
        },
    )
    assert registration.status_code == 201
    token = registration.json()["accessToken"]

    duplicate = client.post(
        "/api/v1/auth/register",
        json={
            "email": "explorateur@agora.example.com",
            "username": "explorateur",
            "password": "MotDePasseSolide2026!",
        },
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "account_already_exists"

    login = client.post(
        "/api/v1/auth/login",
        json={"login": "explorateur", "password": "MotDePasseSolide2026!"},
    )
    assert login.status_code == 200
    profile = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert profile.status_code == 200
    assert profile.json()["email"] == "explorateur@agora.example.com"


def test_openapi_exposes_documented_business_contracts(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()
    assert schema["info"]["title"] == "AI Agora API"
    assert "Arènes" in {tag["name"] for tag in schema["tags"]}
    create_room = schema["paths"]["/api/v1/workspaces/{workspace_id}/rooms"]["post"]
    assert "idempotente" in create_room["summary"]
    assert any(parameter["name"] == "X-Idempotency-Key" for parameter in create_room["parameters"])
