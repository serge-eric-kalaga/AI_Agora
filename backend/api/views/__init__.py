"""Routeurs HTTP de l'API v1."""

from .agents import router as agents_router
from .auth import router as auth_router
from .health import router as health_router
from .providers import router as providers_router
from .resources import router as resources_router
from .rooms import router as rooms_router
from .workspaces import router as workspaces_router

__all__ = [
    "collaboration_router",
    "admin_router",
    "agents_router",
    "auth_router",
    "health_router",
    "providers_router",
    "rooms_router",
    "resources_router",
    "workspaces_router",
]

from .admin import router as admin_router
from .collaboration import router as collaboration_router
