"""Session SQLAlchemy et point d'import des modeles."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from api.configs import Setting


def create_database_engine(database_url: str) -> Engine:
    """Construit un moteur adapte a PostgreSQL ou a SQLite pour les tests."""

    options: dict[str, object] = {"pool_pre_ping": True}
    if database_url.startswith("sqlite"):
        options.update(connect_args={"check_same_thread": False}, poolclass=StaticPool)
    return create_engine(database_url, **options)


engine = create_database_engine(Setting.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """Fournit une transaction courte a une route FastAPI."""

    with SessionLocal() as session:
        yield session


from .models import (  # noqa: E402
    AgentDefinition,
    AuditLog,
    Base,
    ConversationEvent,
    IdempotencyRecord,
    Message,
    MessageReaction,
    ProviderConnection,
    Room,
    RoomParticipant,
    User,
    Workspace,
    WorkspaceMember,
)

__all__ = [
    "AgentDefinition", "AuditLog", "Base", "ConversationEvent", "IdempotencyRecord",
    "Message", "MessageReaction", "ProviderConnection", "Room", "RoomParticipant",
    "SessionLocal", "User", "Workspace", "WorkspaceMember", "engine", "get_db",
]
