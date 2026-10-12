"""Catalogue versionné des agents IA."""

from uuid import UUID

from fastapi import APIRouter, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from api.database.models import AgentDefinition, ProviderConnection
from api.dependencies import (
    CurrentUser,
    DbSession,
    require_workspace_editor,
    require_workspace_member,
)
from api.errors import ConflictError, NotFoundError
from api.schemas.agents import AgentCreate, AgentRead, AgentUpdate
from api.schemas.common import Page
from api.services.audit import record_audit

router = APIRouter(prefix="/workspaces/{workspace_id}/agents", tags=["Agents IA"])


def _agent(db: DbSession, workspace_id: UUID, agent_id: UUID) -> AgentDefinition:
    agent = db.scalar(
        select(AgentDefinition).where(
            AgentDefinition.id == agent_id,
            AgentDefinition.workspace_id == workspace_id,
        )
    )
    if not agent:
        raise NotFoundError("agent_not_found", "L'agent demandé est introuvable.")
    return agent


def _provider_in_workspace(db: DbSession, workspace_id: UUID, provider_id: UUID) -> None:
    exists = db.scalar(
        select(ProviderConnection.id).where(
            ProviderConnection.id == provider_id,
            ProviderConnection.workspace_id == workspace_id,
            ProviderConnection.is_enabled.is_(True),
        )
    )
    if not exists:
        raise NotFoundError("provider_not_found", "Le fournisseur actif demandé est introuvable.")


@router.get("", response_model=Page[AgentRead], summary="Lister les agents de l'espace")
def list_agents(workspace_id: UUID, db: DbSession, current_user: CurrentUser) -> Page[AgentRead]:
    require_workspace_member(db, workspace_id, current_user)
    agents = db.scalars(
        select(AgentDefinition)
        .where(AgentDefinition.workspace_id == workspace_id)
        .order_by(AgentDefinition.name)
    ).all()
    return Page(items=[AgentRead.model_validate(agent) for agent in agents])


@router.post(
    "",
    response_model=AgentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un agent IA",
    description="Valide le fournisseur, conserve le prompt système et initialise la version à 1.",
)
def create_agent(
    workspace_id: UUID,
    payload: AgentCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> AgentRead:
    require_workspace_editor(db, workspace_id, current_user)
    _provider_in_workspace(db, workspace_id, payload.provider_id)
    agent = AgentDefinition(workspace_id=workspace_id, **payload.model_dump())
    db.add(agent)
    try:
        db.flush()
        record_audit(
            db,
            action="agent.created",
            resource_type="agent",
            resource_id=agent.id,
            actor_user_id=current_user.id,
            workspace_id=workspace_id,
            details={"name": agent.name, "model": agent.model},
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("agent_name_taken", "Un agent porte déjà ce nom.") from exc
    db.refresh(agent)
    return AgentRead.model_validate(agent)


@router.patch("/{agent_id}", response_model=AgentRead, summary="Modifier un agent avec contrôle de version")
def update_agent(
    workspace_id: UUID,
    agent_id: UUID,
    payload: AgentUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> AgentRead:
    require_workspace_editor(db, workspace_id, current_user)
    agent = _agent(db, workspace_id, agent_id)
    if agent.version != payload.expected_version:
        raise ConflictError("stale_agent_version", "L'agent a été modifié; rechargez-le avant de réessayer.")
    values = payload.model_dump(exclude_unset=True, exclude={"expected_version"})
    if "provider_id" in values:
        _provider_in_workspace(db, workspace_id, values["provider_id"])
    for field, value in values.items():
        setattr(agent, field, value)
    agent.version += 1
    record_audit(
        db,
        action="agent.updated",
        resource_type="agent",
        resource_id=agent.id,
        actor_user_id=current_user.id,
        workspace_id=workspace_id,
        details={"version": agent.version, "fields": sorted(values)},
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("agent_name_taken", "Un agent porte déjà ce nom.") from exc
    db.refresh(agent)
    return AgentRead.model_validate(agent)
