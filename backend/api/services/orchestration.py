"""Orchestration idempotente d'une réponse d'agent dans une salle."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select

from api.database import SessionLocal
from api.database.models import (
    AgentDefinition,
    ConversationEvent,
    Message,
    MessageKind,
    ProviderConnection,
    ProviderKind,
    Room,
    RoomParticipant,
    RoomStatus,
)

from .events import append_room_event
from .model_clients import ModelRequest, generate_model_response


@dataclass(frozen=True)
class TurnContext:
    room_id: UUID
    trigger_event_id: UUID
    agent_id: UUID
    provider_id: UUID
    model: str
    system_prompt: str
    messages: list[dict[str, str]]
    temperature: float
    max_tokens: int
    chain_depth: int


def _bounded_number(value: object, default: float, minimum: float, maximum: float) -> float:
    if not isinstance(value, int | float):
        return default
    return min(max(float(value), minimum), maximum)


def _prepare_turn(room_id: UUID, trigger_event_id: UUID) -> TurnContext | None:
    with SessionLocal() as db:
        room = db.get(Room, room_id)
        event = db.get(ConversationEvent, trigger_event_id)
        if not room or not event or event.room_id != room.id or room.status != RoomStatus.RUNNING:
            return None
        if event.event_type != "message.created":
            return None
        trigger_message_id = event.payload.get("messageId")
        try:
            trigger_message = db.get(Message, UUID(str(trigger_message_id)))
        except ValueError:
            return None
        if not trigger_message or (
            trigger_message.author_user_id is None and trigger_message.author_agent_id is None
        ):
            return None
        raw_depth = event.payload.get("chainDepth", 0)
        chain_depth = raw_depth if isinstance(raw_depth, int) and raw_depth >= 0 else 0
        idempotency_key = f"agent-turn:{trigger_event_id}"
        if db.scalar(select(Message.id).where(Message.idempotency_key == idempotency_key)):
            return None
        message_count = db.scalar(select(func.count(Message.id)).where(Message.room_id == room.id)) or 0
        started_at = room.started_at
        if started_at and started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        if (
            message_count >= room.max_messages
            or room.amount_spent >= room.budget_limit
            or (
                started_at
                and datetime.now(timezone.utc) - started_at
                >= timedelta(minutes=room.max_duration_minutes)
            )
        ):
            return None
        participants = db.execute(
            select(AgentDefinition, ProviderConnection)
            .join(RoomParticipant, RoomParticipant.agent_id == AgentDefinition.id)
            .join(ProviderConnection, ProviderConnection.id == AgentDefinition.provider_id)
            .where(
                RoomParticipant.room_id == room.id,
                RoomParticipant.is_active.is_(True),
                AgentDefinition.is_active.is_(True),
                ProviderConnection.is_enabled.is_(True),
            )
            .order_by(RoomParticipant.created_at, AgentDefinition.id)
        ).all()
        if not participants:
            return None
        contribution_rows = db.execute(
            select(Message.author_agent_id, func.count(Message.id))
            .where(Message.room_id == room.id, Message.author_agent_id.is_not(None))
            .group_by(Message.author_agent_id)
        ).all()
        contributions = {agent_id: count for agent_id, count in contribution_rows}
        content = trigger_message.content.casefold()
        # Une mention explicite prime; sinon l'agent ayant le moins contribué est favorisé.
        agent, provider = min(
            participants,
            key=lambda item: (
                0 if f"@{item[0].name.casefold()}" in content else 1,
                1 if item[0].id == trigger_message.author_agent_id else 0,
                contributions.get(item[0].id, 0),
                item[0].name.casefold(),
            ),
        )
        names = {item.id: item.name for item, _ in participants}
        history = db.scalars(
            select(Message)
            .where(Message.room_id == room.id, Message.kind == MessageKind.MESSAGE)
            .order_by(Message.created_at.desc())
            .limit(20)
        ).all()
        messages = [
            {
                # Chaque modèle ne doit voir comme réponses `assistant` que ses
                # propres contributions. Les autres agents sont des interlocuteurs ;
                # ce rôle garantit aussi qu'un nouveau tour est réellement demandé.
                "role": "assistant" if message.author_agent_id == agent.id else "user",
                "content": (
                    f"{names.get(message.author_agent_id, 'Agent')}: {message.content}"
                    if message.author_agent_id
                    else message.content
                )[:12_000],
            }
            for message in reversed(history)
        ]
        config = agent.generation_config or {}
        system_prompt = "\n\n".join(
            part
            for part in (
                agent.system_prompt,
                f"Rôle: {agent.role}.",
                f"Sujet de la salle: {room.topic}",
                f"Règles de la salle: {room.rules}" if room.rules else "",
                "Réponds en français, de façon concise, sous le nom de l'agent configuré.",
            )
            if part
        )
        return TurnContext(
            room.id,
            trigger_event_id,
            agent.id,
            provider.id,
            agent.model,
            system_prompt,
            messages,
            _bounded_number(config.get("temperature"), 0.7, 0, 2),
            int(_bounded_number(config.get("maxTokens"), 1024, 64, 8_192)),
            chain_depth,
        )


def _cost(provider: ProviderConnection, prompt_tokens: int, completion_tokens: int) -> Decimal:
    capabilities = provider.capabilities or {}
    input_rate = Decimal(str(capabilities.get("inputCostPerMillion", 0)))
    output_rate = Decimal(str(capabilities.get("outputCostPerMillion", 0)))
    return (input_rate * prompt_tokens + output_rate * completion_tokens) / Decimal(1_000_000)


def execute_room_turn(room_id: UUID, trigger_event_id: UUID) -> dict[str, str]:
    """Génère puis persiste au plus une réponse pour l'événement déclencheur."""

    idempotency_key = f"agent-turn:{trigger_event_id}"
    with SessionLocal() as db:
        completed_event = db.scalar(
            select(ConversationEvent).where(
                ConversationEvent.room_id == room_id,
                ConversationEvent.idempotency_key == idempotency_key,
            )
        )
        if completed_event:
            depth = completed_event.payload.get("chainDepth", 0)
            return {
                "status": "already_completed",
                "roomId": str(room_id),
                "eventId": str(completed_event.id),
                "chainDepth": str(depth if isinstance(depth, int) else 0),
            }
    context = _prepare_turn(room_id, trigger_event_id)
    if not context:
        return {"status": "skipped", "roomId": str(room_id)}
    with SessionLocal() as db:
        provider = db.get(ProviderConnection, context.provider_id)
        if not provider:
            return {"status": "skipped", "roomId": str(room_id)}
        result = generate_model_response(
            provider,
            ModelRequest(
                context.model,
                context.system_prompt,
                context.messages,
                context.temperature,
                context.max_tokens,
            ),
        )
        provider_kind = provider.kind
        cost = _cost(provider, result.prompt_tokens, result.completion_tokens)
    with SessionLocal() as db:
        room = db.scalar(select(Room).where(Room.id == room_id).with_for_update())
        existing = db.scalar(
            select(Message).where(
                Message.room_id == room_id,
                Message.idempotency_key == idempotency_key,
            )
        )
        if existing:
            return {"status": "already_completed", "roomId": str(room_id), "messageId": str(existing.id)}
        if not room or room.status != RoomStatus.RUNNING:
            return {"status": "skipped", "roomId": str(room_id)}
        count = db.scalar(select(func.count(Message.id)).where(Message.room_id == room.id)) or 0
        started_at = room.started_at
        if started_at and started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        expired = bool(
            started_at
            and datetime.now(timezone.utc) - started_at
            >= timedelta(minutes=room.max_duration_minutes)
        )
        if count >= room.max_messages or room.amount_spent + cost > room.budget_limit or expired:
            return {"status": "budget_exhausted", "roomId": str(room_id)}
        message = Message(
            room_id=room.id,
            author_agent_id=context.agent_id,
            content=result.content,
            idempotency_key=idempotency_key,
            metadata_json={
                "model": context.model,
                "providerId": str(context.provider_id),
                "promptTokens": result.prompt_tokens,
                "completionTokens": result.completion_tokens,
                "cost": str(cost),
            },
        )
        db.add(message)
        db.flush()
        total_tokens = result.prompt_tokens + result.completion_tokens
        if provider_kind == ProviderKind.LOCAL:
            room.local_tokens += total_tokens
        else:
            room.cloud_tokens += total_tokens
            room.amount_spent += cost
        event = append_room_event(
            db,
            room.id,
            "message.created",
            {
                "messageId": str(message.id),
                "triggerEventId": str(trigger_event_id),
                "chainDepth": context.chain_depth + 1,
            },
            actor_agent_id=context.agent_id,
            idempotency_key=idempotency_key,
        )
        db.flush()
        db.commit()
        return {
            "status": "completed",
            "roomId": str(room_id),
            "messageId": str(message.id),
            "eventId": str(event.id),
            "chainDepth": str(context.chain_depth + 1),
        }


def record_room_failure(room_id: UUID, trigger_event_id: UUID, error_code: str) -> dict[str, str]:
    """Rend un échec final visible sans révéler le détail du fournisseur."""

    idempotency_key = f"agent-error:{trigger_event_id}"
    with SessionLocal() as db:
        existing = db.scalar(
            select(Message).where(
                Message.room_id == room_id,
                Message.idempotency_key == idempotency_key,
            )
        )
        if existing:
            return {"status": "failed", "roomId": str(room_id), "messageId": str(existing.id)}
        room = db.get(Room, room_id)
        if not room:
            return {"status": "skipped", "roomId": str(room_id)}
        message = Message(
            room_id=room.id,
            kind=MessageKind.SYSTEM,
            content=(
                "Un agent n’a pas pu répondre après les tentatives autorisées. "
                "Vérifiez son fournisseur et son modèle."
            ),
            idempotency_key=idempotency_key,
            metadata_json={"errorCode": error_code},
        )
        db.add(message)
        db.flush()
        append_room_event(
            db,
            room.id,
            "agent.failed",
            {"messageId": str(message.id), "errorCode": error_code},
            idempotency_key=idempotency_key,
        )
        db.commit()
        return {"status": "failed", "roomId": str(room_id), "messageId": str(message.id)}
