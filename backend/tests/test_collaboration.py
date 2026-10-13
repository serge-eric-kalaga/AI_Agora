"""Invitations liées au compte, droits et notifications réellement attribuées."""

from datetime import timedelta
from uuid import UUID

from api.database import SessionLocal
from api.database.models import (
    Message,
    Room,
    User,
    WorkspaceInvitation,
    WorkspaceMember,
    WorkspaceRole,
    utcnow,
)
from api.services.notifications import notify_message


def test_invitation_roles_and_replay(client, account):
    owner = account["headers"]
    ws = account["workspaceId"]
    base = f"/api/v1/workspaces/{ws}"
    guest = client.post(
        "/api/v1/auth/register",
        json={
            "username": "invite",
            "email": "invite@agora.example.com",
            "password": "SecretInvite2026!",
        },
    ).json()
    headers = {"Authorization": f"Bearer {guest['accessToken']}"}
    invitation = client.post(
        base + "/invitations",
        headers=owner,
        json={"email": guest["user"]["email"], "role": "observer"},
    )
    assert invitation.status_code == 201, invitation.text
    token = invitation.json()["token"]
    assert "token" not in client.get(base + "/invitations", headers=owner).json()["items"][0]
    assert (
        client.post(
            "/api/v1/workspaces/invitations/accept", headers=owner, json={"token": token}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/workspaces/invitations/accept", headers=headers, json={"token": token}
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/workspaces/invitations/accept", headers=headers, json={"token": token}
        ).status_code
        == 422
    )
    assert client.get(base, headers=headers).json()["role"] == "observer"
    assert (
        client.post(
            base + "/invitations", headers=headers, json={"email": "another@agora.example.com"}
        ).status_code
        == 403
    )
    assert client.get(base + "/members", headers=headers).json()["items"][0]["email"] is None
    uid = guest["user"]["id"]
    assert (
        client.patch(base + f"/members/{uid}", headers=owner, json={"role": "admin"}).status_code
        == 200
    )
    assert (
        client.patch(
            base + f"/members/{account['user']['id']}", headers=headers, json={"role": "member"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            base + "/invitations",
            headers=headers,
            json={"email": "another@agora.example.com", "role": "admin"},
        ).status_code
        == 403
    )
    assert (
        client.patch(base + f"/members/{uid}", headers=owner, json={"role": "observer"}).status_code
        == 200
    )
    assert (
        client.post(
            base + "/providers", headers=headers, json={"name": "Interdit", "kind": "local"}
        ).status_code
        == 403
    )


def test_revocation_and_expiration(client, account):
    base = f"/api/v1/workspaces/{account['workspaceId']}"
    payload = {"email": account["user"]["email"], "role": "member"}
    i = client.post(base + "/invitations", headers=account["headers"], json=payload).json()
    assert (
        client.delete(base + f"/invitations/{i['id']}", headers=account["headers"]).status_code
        == 204
    )
    assert (
        client.post(
            "/api/v1/workspaces/invitations/accept",
            headers=account["headers"],
            json={"token": i["token"]},
        ).status_code
        == 422
    )
    i = client.post(base + "/invitations", headers=account["headers"], json=payload).json()
    with SessionLocal() as db:
        invitation = db.get(WorkspaceInvitation, UUID(i["id"]))
        invitation.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    assert (
        client.post(
            "/api/v1/workspaces/invitations/accept",
            headers=account["headers"],
            json={"token": i["token"]},
        ).status_code
        == 422
    )


def test_notification_scope_author_and_pagination(client, account):
    ws = UUID(account["workspaceId"])
    uid = UUID(account["user"]["id"])
    with SessionLocal() as db:
        guest = User(
            username="inviteur", email="inviteur@agora.example.com", password_hash="irrelevant"
        )
        db.add(guest)
        db.flush()
        db.add(WorkspaceMember(workspace_id=ws, user_id=guest.id, role=WorkspaceRole.MEMBER))
        room = Room(
            workspace_id=ws,
            created_by_id=uid,
            name="Validation",
            topic="Sujet",
            budget_limit=5,
            max_duration_minutes=60,
        )
        db.add(room)
        db.flush()
        root = Message(
            room_id=room.id, author_user_id=uid, content="Bonjour", idempotency_key="root"
        )
        db.add(root)
        db.flush()
        reply = Message(
            room_id=room.id,
            author_user_id=guest.id,
            reply_to_id=root.id,
            content="@architecte Une réponse.",
            idempotency_key="reply",
        )
        db.add(reply)
        db.flush()
        notify_message(db, room, reply)
        db.commit()
        room_id = room.id
    base = f"/api/v1/workspaces/{ws}"
    alerts = client.get(base + "/notifications?limit=1", headers=account["headers"]).json()
    assert len(alerts["items"]) == 1
    alert = alerts["items"][0]
    assert alert["kind"] == "mention" and alert["authorName"] == "inviteur"
    assert (
        client.put(
            base + f"/notifications/{alert['id']}/read", headers=account["headers"]
        ).status_code
        == 204
    )
    assert client.get(base + "/notifications", headers=account["headers"]).json()["items"][0][
        "readAt"
    ]
    messages = client.get(base + f"/rooms/{room_id}/messages", headers=account["headers"]).json()[
        "items"
    ]
    assert messages[-1]["isMe"] is False or any(
        m["authorUserName"] == "inviteur" and not m["isMe"] for m in messages
    )
    outsider = client.post(
        "/api/v1/auth/register",
        json={
            "username": "outsider",
            "email": "outsider@agora.example.com",
            "password": "SecretOutside2026!",
        },
    ).json()
    assert (
        client.get(
            base + "/notifications", headers={"Authorization": f"Bearer {outsider['accessToken']}"}
        ).status_code
        == 404
    )
