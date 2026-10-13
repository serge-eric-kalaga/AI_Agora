"""Recherche littérale, filtres, pagination et contexte limité à la salle."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select

from api.database import SessionLocal
from api.database.models import Message, Room, User


def test_search_filters_cursor_context_and_room_isolation(client, account):
    with SessionLocal() as db:
        owner = db.scalar(select(User))
        rooms = [
            Room(
                workspace_id=UUID(account["workspaceId"]),
                created_by_id=owner.id,
                name=f"Salle {i}",
                topic="Promenade",
                budget_limit=5,
                max_duration_minutes=60,
            )
            for i in range(2)
        ]
        db.add_all(rooms)
        db.flush()
        base = datetime(2026, 10, 13, 9, tzinfo=timezone.utc)
        messages = [
            Message(
                room_id=rooms[0].id,
                author_user_id=owner.id,
                content=f"Promenade {i} 50%_terminée",
                idempotency_key=str(i),
                created_at=base + timedelta(minutes=i),
            )
            for i in range(30)
        ]
        foreign = Message(
            room_id=rooms[1].id,
            author_user_id=owner.id,
            content="Promenade privée",
            idempotency_key="private",
        )
        db.add_all([*messages, foreign])
        db.commit()
        room_id, user_id, target_id, foreign_id = rooms[0].id, owner.id, messages[15].id, foreign.id
    root = f"/api/v1/workspaces/{account['workspaceId']}/rooms/{room_id}/messages"
    response = client.get(
        root + "/search",
        headers=account["headers"],
        params={"q": "50%_", "limit": 5, "user_id": str(user_id)},
    )
    assert response.status_code == 200
    page = response.json()
    assert len(page["items"]) == 5
    assert page["items"][0]["content"].startswith("Promenade 29 ")
    second = client.get(
        root + "/search",
        headers=account["headers"],
        params={"q": "50%_", "limit": 5, "before": page["nextCursor"]},
    ).json()
    assert not ({item["id"] for item in page["items"]} & {item["id"] for item in second["items"]})
    filtered = client.get(
        root + "/search",
        headers=account["headers"],
        params={"since": "2026-10-13T09:15:00Z", "until": "2026-10-13T09:17:00Z"},
    ).json()
    assert len(filtered["items"]) == 3
    assert (
        client.get(
            root + "/search", headers=account["headers"], params={"since": "2026-10-13T09:15:00"}
        ).status_code
        == 422
    )
    assert (
        client.get(
            root + "/search", headers=account["headers"], params={"before": str(foreign_id)}
        ).status_code
        == 422
    )
    context = client.get(root + f"/{target_id}/context", headers=account["headers"]).json()["items"]
    assert len(context) == 21
    assert context[10]["id"] == str(target_id)
    assert all(item["roomId"] == str(room_id) for item in context)
    assert (
        client.get(root + f"/{foreign_id}/context", headers=account["headers"]).status_code == 404
    )
