"""Orchestration idempotente d'une réponse d'agent dans une salle."""

import hashlib
import json
import re
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
    MessageReaction,
    ProviderConnection,
    ProviderKind,
    Room,
    RoomParticipant,
    RoomStatus,
)

from .events import append_room_event
from .generation_capacity import local_generation_slot
from .model_clients import ModelProviderError, ModelRequest, ModelResult, generate_model_response

_SIMULATION_LABEL = re.compile(r"\s*\(simulation(?: analytique)?\)", re.IGNORECASE)
_HISTORY_SPEAKER_LABEL = re.compile(r"^\s*\[(?:AGENT|HUMAIN)\s+[^\]]+\]\s*", re.IGNORECASE)


@dataclass(frozen=True)
class TurnContext:
    room_id: UUID
    trigger_event_id: UUID
    trigger_message_id: UUID
    agent_id: UUID
    agent_name: str
    participant_names: tuple[str, ...]
    provider_id: UUID
    model: str
    system_prompt: str
    messages: list[dict[str, str]]
    temperature: float
    max_tokens: int
    chain_depth: int
    allow_long_response: bool
    triggered_by_user: bool
    target_author_kind: str
    target_author_name: str


def _bounded_number(value: object, default: float, minimum: float, maximum: float) -> float:
    if not isinstance(value, int | float):
        return default
    return min(max(float(value), minimum), maximum)


def _reaction_for(content: str) -> str:
    """Choisit une réaction courte cohérente avec la réponse produite."""

    normalized = content.casefold()
    if any(word in normalized for word in ("désaccord", "cependant", "réserve", "nuance")):
        return "🤔"
    if any(word in normalized for word in ("priorité", "propose", "recommande", "objectif")):
        return "🎯"
    if any(word in normalized for word in ("solidarité", "soutien", "courage", "paix")):
        return "❤️"
    return "👍"


def _stable_entropy(trigger_event_id: UUID, agent_id: UUID) -> int:
    """Produit un départage stable sans imposer un ordre alphabétique répétitif."""

    digest = hashlib.sha256(f"{trigger_event_id}:{agent_id}".encode()).digest()
    return int.from_bytes(digest[:8], "big")


def _initiative_for(trigger_event_id: UUID) -> str:
    """Varie la manière d'entreprendre le prochain mouvement de conversation."""

    initiatives = (
        "Réponds au point le plus important, puis apporte une nuance personnelle.",
        "Pose une question sincère à un autre participant pour faire avancer l'échange.",
        "Introduis un angle nouveau mais directement lié au sujet actuel.",
        "Relie le dernier message à une idée exprimée plus tôt dans la conversation.",
        "Exprime un désaccord respectueux ou une réserve utile si le contexte s'y prête.",
        "Fais une synthèse très brève, puis propose naturellement la prochaine piste à explorer.",
    )
    return initiatives[trigger_event_id.int % len(initiatives)]


def _target_message_envelope(
    message: Message, participant_names: dict[UUID, str]
) -> tuple[dict[str, str], str, str]:
    """Encode sans ambiguïté l'auteur et le contenu auxquels le tour doit répondre."""

    if message.author_agent_id:
        author_kind = "agent"
        author_name = participant_names.get(message.author_agent_id, "Agent")
        identity_rule = f"Réponds d’abord à l’agent « {author_name} »."
    else:
        author_kind = "humain"
        author_name = "Vous"
        identity_rule = (
            "Réponds d’abord à l’utilisateur humain affiché « Vous ». Cet humain n’est aucun des "
            "agents de la salle et ne doit recevoir le nom ou le titre d’aucun participant."
        )
    envelope = {
        "role": "user",
        "content": (
            "<message_cible>\n"
            f"type_auteur={author_kind}\n"
            f"auteur_affiche={author_name}\n"
            f"message_id={message.id}\n"
            f"regle_identite={identity_rule}\n"
            "contenu_exact:\n"
            f"{message.content[:12_000]}\n"
            "</message_cible>\n"
            "Produis maintenant la réponse à ce message cible. Tu peux ensuite inviter un autre "
            "participant à poursuivre, sans changer l’identité de l’auteur auquel tu réponds."
        ),
    }
    return envelope, author_kind, author_name


def _clean_generated_content(
    content: str,
    participant_names: tuple[str, ...],
    *,
    triggered_by_user: bool = False,
) -> str:
    """Retire les noms artificiels et les identités attribuées à tort à l'humain."""

    cleaned = _HISTORY_SPEAKER_LABEL.sub("", content, count=1)
    cleaned = _SIMULATION_LABEL.sub("", cleaned).strip()
    for name in sorted(participant_names, key=len, reverse=True):
        repeated_name = re.compile(
            rf"^\s*(?:\*\*)?{re.escape(name)}(?:\*\*)?\s*:\s*", re.IGNORECASE
        )
        cleaned = repeated_name.sub("", cleaned, count=1)
    if triggered_by_user:
        # Les petits modèles reprennent parfois le nom d'un agent aperçu dans
        # l'historique pour s'adresser à l'utilisateur pourtant affiché « Vous ».
        aliases = {
            alias
            for name in participant_names
            for alias in (name, name.rsplit(" ", 1)[-1])
            if alias
        }
        for alias in sorted(aliases, key=len, reverse=True):
            wrong_salutation = re.compile(
                rf"^\s*(?:bonjour\s*,?\s*)?"
                rf"(?:(?:monsieur|madame)(?:\s+le|\s+la)?|président(?:e)?)\s+"
                rf"{re.escape(alias)}\s*[,;:]\s*",
                re.IGNORECASE,
            )
            without_salutation = wrong_salutation.sub("", cleaned, count=1)
            if without_salutation != cleaned:
                cleaned = without_salutation[:1].upper() + without_salutation[1:]
                break
    return cleaned.strip()


def _generate_complete_response(provider: ProviderConnection, request: ModelRequest) -> ModelResult:
    """Continue une sortie arrêtée par la limite du fournisseur, sans la recommencer."""

    result = generate_model_response(provider, request)
    content = result.content
    prompt_tokens = result.prompt_tokens
    completion_tokens = result.completion_tokens
    continuations = 0
    while result.truncated and continuations < 3:
        continuation_request = ModelRequest(
            request.model,
            request.system_prompt,
            [
                *request.messages,
                {"role": "assistant", "content": content},
                {
                    "role": "user",
                    "content": (
                        "Continue exactement après le dernier caractère de ta réponse. "
                        "Ne répète ni le début, ni ton nom, ni un titre déjà donné."
                    ),
                },
            ],
            request.temperature,
            request.max_tokens,
        )
        result = generate_model_response(provider, continuation_request)
        content += result.content
        prompt_tokens += result.prompt_tokens
        completion_tokens += result.completion_tokens
        continuations += 1
    return ModelResult(content, prompt_tokens, completion_tokens, result.truncated)


def _condense_response(
    provider: ProviderConnection, request: ModelRequest, result: ModelResult
) -> ModelResult:
    """Réécrit une réponse trop longue au lieu de la couper brutalement."""

    if len(result.content.split()) <= 180:
        return result
    condensed = generate_model_response(
        provider,
        ModelRequest(
            request.model,
            (
                request.system_prompt + "\n\n"
                "Réécris le texte fourni en français, en 100 à 160 mots maximum. "
                "Garde strictement ton identité, ta perspective et le destinataire initial. "
                "Conserve l’idée principale, les réserves utiles et une proposition concrète. "
                "N’ajoute aucun nom, titre, préambule ou commentaire sur la réécriture."
            ),
            [
                *request.messages,
                {"role": "user", "content": "Texte à condenser :\n" + result.content},
            ],
            min(request.temperature, 0.3),
            min(request.max_tokens, 512),
        ),
    )
    return ModelResult(
        condensed.content,
        result.prompt_tokens + condensed.prompt_tokens,
        result.completion_tokens + condensed.completion_tokens,
        condensed.truncated,
    )


def _has_identity_conflict(content: str, speaker: str, participants: tuple[str, ...]) -> bool:
    """Repère des indices explicites, sans juger les opinions du personnage."""

    # Une citation de l'autre participant peut légitimement parler de nous.
    prose = re.sub(r'«[^»]*»|“[^”]*”|"[^"\n]*"', "", content)
    aliases = (speaker, speaker.rsplit(" ", 1)[-1])
    for alias in aliases:
        if re.search(
            rf"\b{re.escape(alias)}\s+(?:refuse|propose|souhaite|affirme|défend|exige|"
            rf"veut|soutient|doit|est)\b",
            prose,
            re.IGNORECASE,
        ):
            return True
    for other in participants:
        if other == speaker:
            continue
        if re.search(
            rf"(?:^\s*(?:\*\*)?{re.escape(other)}(?:\*\*)?\s*:|"
            rf"\bje suis\s+{re.escape(other)}\b)",
            prose,
            re.IGNORECASE,
        ):
            return True
    return False


def _repair_identity(
    provider: ProviderConnection,
    request: ModelRequest,
    result: ModelResult,
    speaker: str,
    participants: tuple[str, ...],
) -> ModelResult:
    """Régénère une seule fois un tour incohérent ; ne retouche pas ses opinions."""

    if not _has_identity_conflict(result.content, speaker, participants):
        return result
    repaired = _generate_complete_response(
        provider,
        ModelRequest(
            request.model,
            request.system_prompt
            + (
                f"\nContrôle d'identité : réponds exclusivement depuis le profil de {speaker}. "
                "Utilise je/nous pour ta propre position et distingue celle de ton interlocuteur. "
                "Repars du message cible, sans imiter les formulations de l'historique."
            ),
            request.messages,
            min(request.temperature, 0.3),
            request.max_tokens,
        ),
    )
    if _has_identity_conflict(repaired.content, speaker, participants):
        # Ne jamais publier sous un nom une réponse explicitement attribuée à un autre.
        raise ModelProviderError(
            "Identité du locuteur incohérente après régénération.",
            code="speaker_identity_conflict",
            retryable=False,
        )
    return ModelResult(
        repaired.content,
        result.prompt_tokens + repaired.prompt_tokens,
        result.completion_tokens + repaired.completion_tokens,
        repaired.truncated,
    )


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
        latest_message_id = db.scalar(
            select(Message.id)
            .where(Message.room_id == room.id, Message.kind == MessageKind.MESSAGE)
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(1)
        )
        # Un nouveau message humain ou agent prend immédiatement la main sur une
        # ancienne tâche planifiée. Une salle ne conserve ainsi qu'un seul fil autonome.
        if latest_message_id != trigger_message.id:
            return None
        raw_depth = event.payload.get("chainDepth", 0)
        chain_depth = raw_depth if isinstance(raw_depth, int) and raw_depth >= 0 else 0
        idempotency_key = f"agent-turn:{trigger_event_id}"
        if db.scalar(select(Message.id).where(Message.idempotency_key == idempotency_key)):
            return None
        started_at = room.started_at
        if started_at and started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        if room.amount_spent >= room.budget_limit or (
            started_at
            and datetime.now(timezone.utc) - started_at
            >= timedelta(minutes=room.max_duration_minutes)
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
        recent_speakers = list(
            db.scalars(
                select(Message.author_agent_id)
                .where(Message.room_id == room.id, Message.author_agent_id.is_not(None))
                .order_by(Message.created_at.desc(), Message.id.desc())
                .limit(4)
            )
        )
        content = trigger_message.content.casefold()
        mentioned_agent_ids = {
            item[0].id for item in participants if f"@{item[0].name.casefold()}" in content
        }
        reply_target_id: UUID | None = None
        if (
            trigger_message.author_user_id is not None
            and not mentioned_agent_ids
            and trigger_message.reply_to_id is not None
        ):
            quoted_message = db.get(Message, trigger_message.reply_to_id)
            participant_ids = {item[0].id for item in participants}
            if (
                quoted_message
                and quoted_message.room_id == room.id
                and quoted_message.author_agent_id in participant_ids
            ):
                reply_target_id = quoted_message.author_agent_id

        # Une mention explicite prime, puis l'agent cité par une réponse humaine.
        # Sinon les participants les moins entendus sont favorisés, avec un
        # départage stable mais varié et une pénalité pour les prises de parole récentes.
        agent, provider = min(
            participants,
            key=lambda item: (
                0 if item[0].id in mentioned_agent_ids or item[0].id == reply_target_id else 1,
                1 if item[0].id == trigger_message.author_agent_id else 0,
                contributions.get(item[0].id, 0),
                (
                    len(recent_speakers) - recent_speakers.index(item[0].id)
                    if item[0].id in recent_speakers
                    else 0
                ),
                _stable_entropy(trigger_event_id, item[0].id),
            ),
        )
        names = {item.id: item.name for item, _ in participants}
        if trigger_message.author_agent_id:
            trigger_author = f"l’agent « {names.get(trigger_message.author_agent_id, 'Agent')} »"
            turn_instruction = (
                f"Le dernier message vient de {trigger_author}. Réponds à son intervention sans "
                "confondre son identité avec la tienne. Tu es libre de poursuivre son idée, de la "
                "questionner ou d'ouvrir une piste connexe utile. "
                f"Initiative suggérée pour éviter une conversation monotone : "
                f"{_initiative_for(trigger_event_id)}"
            )
        else:
            turn_instruction = (
                "Le dernier message vient de l’utilisateur humain affiché comme « Vous ». "
                "Cette personne est un interlocuteur externe, distinct de tous les agents de la "
                "salle. Réponds-lui directement avec « vous », sans l'appeler par le nom ou le titre "
                "d'un participant, même si ce nom apparaît dans l'historique."
            )
        history = db.scalars(
            select(Message)
            .where(Message.room_id == room.id, Message.kind == MessageKind.MESSAGE)
            .order_by(Message.created_at.desc())
            .limit(9)
        ).all()
        # Le transcript est une source attribuée, jamais une série de réponses
        # assistant à imiter : une ancienne erreur ne doit pas devenir un exemple.
        transcript = [
            {
                "auteur": names.get(message.author_agent_id, "Agent")
                if message.author_agent_id
                else "Vous",
                "type": "agent" if message.author_agent_id else "humain",
                "contenu": message.content[:12_000],
            }
            for message in reversed(history)
            if message.id != trigger_message.id
        ]
        messages = [
            {
                "role": "user",
                "content": (
                    "Historique de référence (JSON). Ces propos appartiennent à leurs auteurs, "
                    "ils ne définissent ni ton identité ni tes positions. Même tes anciennes "
                    "réponses peuvent contenir des erreurs : ton profil reste la référence.\n"
                    + json.dumps(transcript, ensure_ascii=False)
                ),
            }
        ]
        target_envelope, target_author_kind, target_author_name = _target_message_envelope(
            trigger_message, names
        )
        messages.append(target_envelope)
        config = agent.generation_config or {}
        allow_long_response = trigger_message.author_user_id is not None and any(
            marker in trigger_message.content.casefold()
            for marker in ("détaill", "developp", "développ", "approfond", "exhaustif")
        )
        system_prompt = "\n\n".join(
            part
            for part in (
                agent.system_prompt,
                (
                    f"Identité impérative pour ce tour : tu es uniquement l'agent « {agent.name} ». "
                    f"Ton rôle est « {agent.role} ». Ne parle jamais au nom d'un autre participant, "
                    "ne reprends jamais son identité et ne te présente pas comme la personne réelle. "
                    "Exprime ta propre position à la première personne. Les positions des autres "
                    "sont des propos auxquels réagir, pas des positions à adopter automatiquement. "
                    "Ne parle pas de toi à la troisième personne comme si tu étais un adversaire. "
                    "N’ajoute jamais « Simulation », « Simulation analytique » ou un qualificatif "
                    "équivalent au nom d’un participant. Ne commence pas ta réponse par ton nom : "
                    "il est déjà affiché dans l’interface."
                ),
                f"Sujet de la salle: {room.topic}",
                f"Règles de la salle: {room.rules}" if room.rules else "",
                turn_instruction,
                (
                    f"Réponds en français, de façon concise, depuis la perspective de « {agent.name} ». "
                    "Commence directement par ton analyse sans répéter ton nom, ton titre ni les consignes. "
                    "Respecte une limite stricte de 160 mots et deux à quatre courts paragraphes. "
                    "Développe davantage "
                    "uniquement si l’utilisateur demande explicitement une réponse détaillée ou si la "
                    "complexité du sujet le rend indispensable."
                ),
            )
            if part
        )
        return TurnContext(
            room.id,
            trigger_event_id,
            trigger_message.id,
            agent.id,
            agent.name,
            tuple(names.values()),
            provider.id,
            agent.model,
            system_prompt,
            messages,
            _bounded_number(config.get("temperature"), 0.7, 0, 2),
            int(_bounded_number(config.get("maxTokens"), 1024, 64, 8_192)),
            chain_depth,
            allow_long_response,
            trigger_message.author_user_id is not None,
            target_author_kind,
            target_author_name,
        )


def _cost(provider: ProviderConnection, prompt_tokens: int, completion_tokens: int) -> Decimal:
    capabilities = provider.capabilities or {}
    input_rate = Decimal(str(capabilities.get("inputCostPerMillion", 0)))
    output_rate = Decimal(str(capabilities.get("outputCostPerMillion", 0)))
    return (input_rate * prompt_tokens + output_rate * completion_tokens) / Decimal(1_000_000)


def _publish_typing(context: TurnContext, typing: bool) -> None:
    """Diffuse un état éphémère sans conserver de verrou pendant l'appel au modèle."""

    event_type = "agent.typing" if typing else "agent.idle"
    with SessionLocal() as db:
        append_room_event(
            db,
            context.room_id,
            event_type,
            {"agentId": str(context.agent_id)},
            actor_agent_id=context.agent_id,
        )
        db.commit()


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
        _publish_typing(context, True)
        try:
            request = ModelRequest(
                context.model,
                context.system_prompt,
                context.messages,
                context.temperature,
                context.max_tokens,
            )
            with local_generation_slot(provider):
                result = _generate_complete_response(provider, request)
                if not context.allow_long_response:
                    result = _condense_response(provider, request, result)
                result = _repair_identity(
                    provider, request, result, context.agent_name, context.participant_names
                )
        finally:
            _publish_typing(context, False)
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
            return {
                "status": "already_completed",
                "roomId": str(room_id),
                "messageId": str(existing.id),
            }
        if not room or room.status != RoomStatus.RUNNING:
            return {"status": "skipped", "roomId": str(room_id)}
        latest_message_id = db.scalar(
            select(Message.id)
            .where(Message.room_id == room.id, Message.kind == MessageKind.MESSAGE)
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(1)
        )
        if latest_message_id != context.trigger_message_id:
            return {"status": "superseded", "roomId": str(room_id)}
        started_at = room.started_at
        if started_at and started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        expired = bool(
            started_at
            and datetime.now(timezone.utc) - started_at
            >= timedelta(minutes=room.max_duration_minutes)
        )
        if room.amount_spent + cost > room.budget_limit or expired:
            return {"status": "budget_exhausted", "roomId": str(room_id)}
        message = Message(
            room_id=room.id,
            author_agent_id=context.agent_id,
            reply_to_id=context.trigger_message_id,
            content=_clean_generated_content(
                result.content,
                context.participant_names,
                triggered_by_user=context.triggered_by_user,
            ),
            idempotency_key=idempotency_key,
            metadata_json={
                "model": context.model,
                "providerId": str(context.provider_id),
                "promptTokens": result.prompt_tokens,
                "completionTokens": result.completion_tokens,
                "cost": str(cost),
                "replyToAuthorKind": context.target_author_kind,
                "replyToAuthorName": context.target_author_name,
            },
        )
        db.add(message)
        db.flush()
        reaction_emoji = _reaction_for(message.content)
        db.add(
            MessageReaction(
                message_id=context.trigger_message_id,
                agent_id=context.agent_id,
                emoji=reaction_emoji,
            )
        )
        append_room_event(
            db,
            room.id,
            "reaction.updated",
            {
                "messageId": str(context.trigger_message_id),
                "emoji": reaction_emoji,
                "present": True,
                "agentId": str(context.agent_id),
            },
            actor_agent_id=context.agent_id,
            idempotency_key=f"agent-reaction:{trigger_event_id}",
        )
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
