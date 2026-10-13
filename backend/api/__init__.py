"""Fabrique de l'application FastAPI AI Agora."""

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

from api.configs import Settings, get_settings
from api.errors import DomainError
from api.middleware.request_context import RequestContextMiddleware
from api.schemas.common import ErrorResponse
from api.views import (
    agents_router,
    auth_router,
    health_router,
    providers_router,
    resources_router,
    rooms_router,
    workspaces_router,
)

DESCRIPTION = """
API transactionnelle de **AI Agora**, une plateforme où plusieurs agents IA
collaborent dans des arènes supervisées.

### Principes du contrat

* authentification OAuth2 Bearer par JWT ;
* isolation des ressources par espace de travail ;
* commandes sensibles idempotentes via `X-Idempotency-Key` ;
* contrôle de version pour prévenir les modifications concurrentes ;
* événements ordonnés, relisibles en REST et diffusés en SSE ;
* secrets fournisseurs chiffrés et jamais renvoyés au client.
"""

TAGS = [
    {"name": "Authentification", "description": "Création de compte et jetons d'accès."},
    {"name": "Espaces de travail", "description": "Isolation multi-utilisateur et audit."},
    {"name": "Fournisseurs IA", "description": "Connexions chiffrées aux modèles cloud ou locaux."},
    {"name": "Agents IA", "description": "Personas, prompts, modèles et paramètres de génération."},
    {"name": "Arènes", "description": "Participants, états, messages, réactions et événements."},
    {
        "name": "Documents et sources",
        "description": "Pièces jointes, instantanés publics et provenance.",
    },
    {"name": "Santé", "description": "Sondes Docker et diagnostic des dépendances."},
]

COMMON_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {
        "model": ErrorResponse,
        "description": "Jeton absent, invalide ou expiré.",
    },
    403: {
        "model": ErrorResponse,
        "description": "Le compte authentifié ne possède pas le rôle requis.",
    },
    409: {
        "model": ErrorResponse,
        "description": "Conflit d'unicité, d'état ou de version concurrente.",
    },
    422: {
        "model": ErrorResponse,
        "description": "Requête syntaxiquement valide mais refusée par la validation métier.",
    },
}


def _error_body(request: Request, code: str, message: str, fields=None) -> dict:  # type: ignore[no-untyped-def]
    return {
        "error": {
            "code": code,
            "message": message,
            "requestId": getattr(request.state, "request_id", None),
            "fields": fields,
        }
    }


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or get_settings()
    logging.basicConfig(
        level=getattr(logging, config.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    app = FastAPI(
        title=config.app_name,
        version="0.1.0",
        description=DESCRIPTION,
        openapi_tags=TAGS,
        responses=COMMON_RESPONSES,
        docs_url="/docs" if config.docs_enabled else None,
        redoc_url="/redoc" if config.docs_enabled else None,
        openapi_url="/openapi.json" if config.docs_enabled else None,
    )
    app.state.settings = config
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.frontend_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Idempotency-Key", "X-Request-ID"],
    )

    for router in (
        auth_router,
        workspaces_router,
        providers_router,
        agents_router,
        rooms_router,
        resources_router,
        health_router,
    ):
        app.include_router(router, prefix=config.api_v1_prefix)

    @app.exception_handler(DomainError)
    async def domain_error(request: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(request, exc.code, exc.message, exc.fields),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        fields: dict[str, list[str]] = {}
        for error in exc.errors():
            key = ".".join(
                str(item) for item in error["loc"] if item not in {"body", "query", "path"}
            )
            fields.setdefault(key or "request", []).append(error["msg"])
        return JSONResponse(
            status_code=422,
            content=_error_body(
                request, "validation_error", "La requête contient des données invalides.", fields
            ),
        )

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(request, "http_error", str(exc.detail)),
            headers=exc.headers,
        )

    if config.metrics_enabled:
        Instrumentator(excluded_handlers=["/metrics"]).instrument(app).expose(
            app, endpoint="/metrics", include_in_schema=False
        )
    return app


createApp = create_app
