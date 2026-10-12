"""Sondes distinctes pour le processus et ses dépendances."""

from datetime import datetime, timezone

from fastapi import APIRouter
from redis import Redis
from sqlalchemy import text

from api.configs import get_settings
from api.dependencies import DbSession
from api.errors import DomainError
from api.schemas.common import HealthComponent, HealthResponse

router = APIRouter(prefix="/health", tags=["Santé"])


@router.get("/live", response_model=HealthResponse, summary="Vérifier que le processus répond")
def live() -> HealthResponse:
    return HealthResponse(status="ok", version="0.1.0", checked_at=datetime.now(timezone.utc))


@router.get(
    "/ready",
    response_model=HealthResponse,
    summary="Vérifier PostgreSQL et Redis",
    description="Retourne 503 tant qu'une dépendance indispensable n'est pas joignable.",
)
def ready(db: DbSession) -> HealthResponse:
    components: dict[str, HealthComponent] = {}
    try:
        db.execute(text("SELECT 1"))
        components["database"] = HealthComponent(status="ok")
    except Exception as exc:
        raise DomainError("database_unavailable", "La base de données est indisponible.", 503) from exc
    try:
        client = Redis.from_url(get_settings().redis_url, socket_connect_timeout=1, socket_timeout=1)
        client.ping()
        client.close()
        components["redis"] = HealthComponent(status="ok")
    except Exception as exc:
        raise DomainError("redis_unavailable", "Redis est indisponible.", 503) from exc
    return HealthResponse(
        status="ok", version="0.1.0", components=components, checked_at=datetime.now(timezone.utc)
    )
