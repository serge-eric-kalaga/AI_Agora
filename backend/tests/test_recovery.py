"""Capacité partagée et reprise des conversations depuis PostgreSQL."""

import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from api.database import SessionLocal
from api.database.models import (
    ConversationEvent,
    ProviderConnection,
    ProviderKind,
    Room,
    RoomStatus,
    User,
)
from api.services.generation_capacity import LocalProviderBusy, local_generation_slot
from api.tasks import recover_active_rooms


class FakeLock:
    def __init__(self, held: set[str], key: str):
        self.held, self.key = held, key

    def acquire(self, **_kwargs):
        if self.key in self.held:
            return False
        self.held.add(self.key)
        return True

    def release(self):
        self.held.remove(self.key)


def test_local_capacity_is_shared_by_endpoint_and_released(monkeypatch):
    held: set[str] = set()

    class FakeRedis:
        def lock(self, key, **kwargs):
            assert kwargs["thread_local"] is False
            return FakeLock(held, key)

        def close(self):
            pass

    monkeypatch.setattr("api.services.generation_capacity.Redis.from_url", lambda _: FakeRedis())
    first = ProviderConnection(kind=ProviderKind.LOCAL, base_url="http://ollama.test:11434")
    same = ProviderConnection(kind=ProviderKind.LOCAL, base_url="http://ollama.test:11434/")
    other = ProviderConnection(kind=ProviderKind.LOCAL, base_url="http://other.test:11434")
    with pytest.raises(ValueError), local_generation_slot(first):
        with pytest.raises(LocalProviderBusy), local_generation_slot(same):
            pytest.fail("Une seconde génération a dépassé la capacité")
        with local_generation_slot(other):
            assert len(held) == 2
        raise ValueError("Le modèle a échoué")
    assert held == set()
    with local_generation_slot(same):
        assert len(held) == 1
    assert held == set()


@pytest.mark.parametrize(
    "case,expected",
    [
        ("lost", 1),
        ("locked", 0),
        ("queued", 0),
        ("paused", 0),
        ("expired", 0),
        ("budget", 0),
    ],
)
def test_recovery_respects_room_state_and_pending_work(account, monkeypatch, case, expected):
    with SessionLocal() as db:
        user_id = db.scalar(select(User.id))
        room = Room(
            workspace_id=UUID(account["workspaceId"]),
            created_by_id=user_id,
            name="Reprise",
            topic="Reprendre sans doublon",
            budget_limit=Decimal("5"),
            amount_spent=Decimal("5" if case == "budget" else "0"),
            max_duration_minutes=60,
            status=RoomStatus.PAUSED if case == "paused" else RoomStatus.RUNNING,
            started_at=datetime.now(timezone.utc)
            - timedelta(minutes=90 if case == "expired" else 1),
        )
        db.add(room)
        db.flush()
        event = ConversationEvent(
            room_id=room.id,
            sequence=1,
            event_type="message.created",
            payload={"messageId": str(uuid4())},
            idempotency_key="trigger",
        )
        db.add(event)
        db.commit()
        room_id, event_id = room.id, event.id
    held: set[str] = set()
    scheduled = []

    class FakeRedis:
        def lock(self, key, **_kwargs):
            return FakeLock(held, key)

        def exists(self, _key):
            return case == "locked"

        def get(self, _key):
            return str(time.time()).encode() if case == "queued" else None

        def close(self):
            pass

    monkeypatch.setattr("api.tasks.Redis.from_url", lambda _: FakeRedis())
    monkeypatch.setattr(
        "api.tasks.schedule_room_turn",
        lambda room, event, **kwargs: scheduled.append((room, event, kwargs)) or True,
    )
    assert recover_active_rooms.run() == {"scheduled": expected}
    assert scheduled == ([(str(room_id), str(event_id), {"force": True})] if expected else [])
    assert held == set()
