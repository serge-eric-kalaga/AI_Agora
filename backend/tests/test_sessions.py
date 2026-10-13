"""Expiration absolue, révocation et protection du secret de session."""

import hashlib
from datetime import timedelta

from fastapi.testclient import TestClient

from api.database import SessionLocal
from api.database.models import AuthSession, utcnow


def test_refresh_and_revoke(client: TestClient) -> None:
    payload = client.post(
        "/api/v1/auth/register",
        json={
            "username": "sessiontest",
            "email": "session@agora.example.com",
            "password": "SecretSession2026!",
        },
    ).json()
    secret = payload["refreshToken"]
    with SessionLocal() as db:
        session = db.query(AuthSession).one()
        assert session.token_hash == hashlib.sha256(secret.encode()).hexdigest()
        assert session.token_hash != secret
    response = client.post("/api/v1/auth/refresh", json={"refreshToken": secret})
    assert response.status_code == 200
    assert response.json()["refreshExpiresIn"] <= 7 * 86400
    assert (
        client.get(
            "/api/v1/auth/me", headers={"Authorization": "Bearer " + response.json()["accessToken"]}
        ).status_code
        == 200
    )
    for _ in range(2):
        assert client.post("/api/v1/auth/logout", json={"refreshToken": secret}).status_code == 204
    assert client.post("/api/v1/auth/refresh", json={"refreshToken": secret}).status_code == 401


def test_expired_and_unknown_session(client: TestClient, account: dict[str, object]) -> None:
    with SessionLocal() as db:
        session = db.query(AuthSession).one()
        session.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    assert client.post("/api/v1/auth/refresh", json={"refreshToken": "x" * 64}).status_code == 401
    response = client.post(
        "/api/v1/auth/login", json={"login": "architecte", "password": "UnePhraseSecrete2026!"}
    )
    secret = response.json()["refreshToken"]
    with SessionLocal() as db:
        session = (
            db.query(AuthSession)
            .filter_by(token_hash=hashlib.sha256(secret.encode()).hexdigest())
            .one()
        )
        session.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    assert client.post("/api/v1/auth/refresh", json={"refreshToken": secret}).status_code == 401
