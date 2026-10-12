"""Infrastructure de test isolée sur une base SQLite en mémoire."""

import os

os.environ.update(
    {
        "APP_ENVIRONMENT": "test",
        "DATABASE_URL": "sqlite+pysqlite:///:memory:",
        "REDIS_URL": "redis://127.0.0.1:6399/15",
        "METRICS_ENABLED": "false",
        "JWT_SECRET": "test-secret-with-enough-entropy-for-ai-agora",
    }
)

import pytest
from fastapi.testclient import TestClient

from api import create_app
from api.database import Base, engine


@pytest.fixture(autouse=True)
def clean_database():  # type: ignore[no-untyped-def]
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def client() -> TestClient:
    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture
def account(client: TestClient) -> dict[str, object]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "architecte@agora.example.com",
            "username": "architecte",
            "password": "UnePhraseSecrete2026!",
        },
    )
    assert response.status_code == 201, response.text
    payload = response.json()
    headers = {"Authorization": f"Bearer {payload['accessToken']}"}
    workspaces = client.get("/api/v1/workspaces", headers=headers).json()["items"]
    return {"headers": headers, "workspaceId": workspaces[0]["id"], "user": payload["user"]}
