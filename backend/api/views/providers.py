"""Administration sécurisée des connexions aux fournisseurs IA."""

from uuid import UUID

from fastapi import APIRouter, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from api.database.models import ProviderConnection
from api.dependencies import (
    CurrentUser,
    DbSession,
    require_workspace_editor,
    require_workspace_member,
)
from api.errors import ConflictError, NotFoundError
from api.schemas.common import Page
from api.schemas.providers import ProviderCreate, ProviderRead, ProviderTestResult, ProviderUpdate
from api.security import encrypt_secret
from api.services.audit import record_audit
from api.services.providers import test_provider

router = APIRouter(prefix="/workspaces/{workspace_id}/providers", tags=["Fournisseurs IA"])


def _provider(db: DbSession, workspace_id: UUID, provider_id: UUID) -> ProviderConnection:
    provider = db.scalar(
        select(ProviderConnection).where(
            ProviderConnection.id == provider_id,
            ProviderConnection.workspace_id == workspace_id,
        )
    )
    if not provider:
        raise NotFoundError("provider_not_found", "Le fournisseur demandé est introuvable.")
    return provider


def _read(provider: ProviderConnection) -> ProviderRead:
    return ProviderRead(
        id=provider.id,
        workspace_id=provider.workspace_id,
        name=provider.name,
        kind=provider.kind,
        base_url=provider.base_url,
        models=provider.models,
        capabilities=provider.capabilities,
        is_enabled=provider.is_enabled,
        has_api_key=bool(provider.encrypted_api_key),
        created_at=provider.created_at,
        updated_at=provider.updated_at,
    )


@router.get("", response_model=Page[ProviderRead], summary="Lister les fournisseurs configurés")
def list_providers(workspace_id: UUID, db: DbSession, current_user: CurrentUser) -> Page[ProviderRead]:
    require_workspace_member(db, workspace_id, current_user)
    providers = db.scalars(
        select(ProviderConnection)
        .where(ProviderConnection.workspace_id == workspace_id)
        .order_by(ProviderConnection.name)
    ).all()
    return Page(items=[_read(item) for item in providers])


@router.post(
    "",
    response_model=ProviderRead,
    status_code=status.HTTP_201_CREATED,
    summary="Configurer un fournisseur IA",
    description="La clé API est chiffrée avant stockage et n'apparaît jamais dans la réponse.",
)
def create_provider(
    workspace_id: UUID,
    payload: ProviderCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> ProviderRead:
    require_workspace_editor(db, workspace_id, current_user)
    provider = ProviderConnection(
        workspace_id=workspace_id,
        name=payload.name,
        kind=payload.kind,
        base_url=str(payload.base_url) if payload.base_url else None,
        encrypted_api_key=encrypt_secret(payload.api_key.get_secret_value()) if payload.api_key else None,
        models=payload.models,
        capabilities=payload.capabilities,
        is_enabled=payload.is_enabled,
    )
    db.add(provider)
    try:
        db.flush()
        record_audit(
            db,
            action="provider.created",
            resource_type="provider",
            resource_id=provider.id,
            actor_user_id=current_user.id,
            workspace_id=workspace_id,
            details={"name": provider.name, "kind": provider.kind.value},
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("provider_name_taken", "Un fournisseur porte déjà ce nom.") from exc
    db.refresh(provider)
    return _read(provider)


@router.patch("/{provider_id}", response_model=ProviderRead, summary="Modifier un fournisseur")
def update_provider(
    workspace_id: UUID,
    provider_id: UUID,
    payload: ProviderUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> ProviderRead:
    require_workspace_editor(db, workspace_id, current_user)
    provider = _provider(db, workspace_id, provider_id)
    values = payload.model_dump(exclude_unset=True, exclude={"api_key"})
    if "base_url" in values and values["base_url"] is not None:
        values["base_url"] = str(values["base_url"])
    for field, value in values.items():
        setattr(provider, field, value)
    if "api_key" in payload.model_fields_set and payload.api_key:
        provider.encrypted_api_key = encrypt_secret(payload.api_key.get_secret_value())
    record_audit(
        db,
        action="provider.updated",
        resource_type="provider",
        resource_id=provider.id,
        actor_user_id=current_user.id,
        workspace_id=workspace_id,
        details={"fields": sorted(payload.model_fields_set)},
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("provider_name_taken", "Un fournisseur porte déjà ce nom.") from exc
    db.refresh(provider)
    return _read(provider)


@router.post(
    "/{provider_id}/test",
    response_model=ProviderTestResult,
    summary="Tester la connexion sans exposer le secret",
)
async def check_provider(
    workspace_id: UUID,
    provider_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> ProviderTestResult:
    require_workspace_editor(db, workspace_id, current_user)
    reachable, message, models, tested_at = await test_provider(_provider(db, workspace_id, provider_id))
    return ProviderTestResult(
        reachable=reachable,
        message=message,
        models_discovered=models,
        tested_at=tested_at,
    )
