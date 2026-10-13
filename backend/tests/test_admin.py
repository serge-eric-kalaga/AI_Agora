"""Le privilège global est vérifié en base et ne divulgue aucun secret."""

from uuid import UUID

from sqlalchemy import select

from api.database import SessionLocal
from api.database.models import Room, User, Workspace, WorkspaceMember


def test_global_read_requires_superadmin(client, account):
    headers = account["headers"]
    assert client.get("/api/v1/admin/users", headers=headers).status_code == 403
    other = client.post(
        "/api/v1/auth/register",
        json={
            "username": "seconduser",
            "email": "second@agora.example.com",
            "password": "SecretSecond2026!",
            "isSuperadmin": True,
        },
    ).json()
    assert other["user"]["isSuperadmin"] is False
    with SessionLocal() as db:
        user = db.get(User, UUID(account["user"]["id"]))
        user.is_superadmin = True
        workspace = db.scalar(
            select(Workspace).where(Workspace.owner_id == UUID(other["user"]["id"]))
        )
        room = Room(
            workspace_id=workspace.id,
            created_by_id=workspace.owner_id,
            name="Autre espace",
            topic="Sujet",
            budget_limit=5,
            max_duration_minutes=60,
        )
        db.add(room)
        db.commit()
        rid = room.id
        wid = workspace.id
    response = client.get("/api/v1/admin/users?limit=1", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["nextCursor"]
    assert not any("password" in key or "token" in key for key in response.json()["items"][0])
    assert (
        client.get("/api/v1/admin/users?q=second", headers=headers).json()["items"][0]["username"]
        == "seconduser"
    )
    rooms = client.get("/api/v1/admin/rooms", headers=headers).json()["items"]
    assert str(rid) in {r["id"] for r in rooms}
    assert client.get(f"/api/v1/admin/rooms/{rid}/messages", headers=headers).status_code == 200
    # Les mêmes routes servent la vue globale et les conversations en direct.
    spaces = client.get("/api/v1/workspaces", headers=headers).json()["items"]
    assert str(wid) in {space["id"] for space in spaces}
    for suffix in ("", "/rooms", "/agents", "/providers", "/analytics", "/members"):
        assert client.get(f"/api/v1/workspaces/{wid}{suffix}", headers=headers).status_code == 200
    for suffix in ("", "/messages", "/memory", "/resources"):
        response = client.get(f"/api/v1/workspaces/{wid}/rooms/{rid}{suffix}", headers=headers)
        assert response.status_code == 200, response.text
    with SessionLocal() as db:
        assert (
            db.scalar(
                select(WorkspaceMember).where(
                    WorkspaceMember.workspace_id == wid,
                    WorkspaceMember.user_id == UUID(account["user"]["id"]),
                )
            )
            is None
        )
    with SessionLocal() as db:
        user = db.get(User, UUID(account["user"]["id"]))
        user.is_superadmin = False
        db.commit()
    assert client.get("/api/v1/admin/users", headers=headers).status_code == 403

    assert client.get(f"/api/v1/workspaces/{wid}/rooms/{rid}", headers=headers).status_code == 404
    assert str(wid) not in {
        space["id"] for space in client.get("/api/v1/workspaces", headers=headers).json()["items"]
    }
