"""Routeurs HTTP de l'API v1."""

from .agents import router as agents_router
from .auth import router as auth_router
from .health import router as health_router
from .providers import router as providers_router
from .rooms import router as rooms_router
from .workspaces import router as workspaces_router

__all__ = [
    "agents_router",
    "auth_router",
    "health_router",
    "providers_router",
    "rooms_router",
    "workspaces_router",
]
