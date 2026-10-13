"""Contrats des arènes, messages, réactions et événements temps réel."""

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from api.database.models import MessageKind, RoomMode, RoomStatus, RoomVisibility, TemporalMode

from .common import APIModel


class ConversationSettings(APIModel):
    pace: Literal["calm", "normal", "animated"] = Field(
        default="normal",
        description="Pause minimale entre deux générations : 30, 10 ou 3 secondes.",
    )
    autonomy: Literal["guided", "balanced", "free"] = Field(
        default="free",
        description="Guidée : réponse aux humains. Équilibrée : échanges mesurés. Libre : initiatives autonomes.",
    )
    response_length: Literal["brief", "standard", "detailed"] = Field(
        default="brief",
        description="Préférence de longueur ; une demande explicite de détail reste prioritaire.",
    )


class ConversationSettingsUpdate(ConversationSettings):
    tools: list[Literal["web", "files", "code"]] | None = Field(
        default=None,
        description="Autorisations de la salle ; les profils des agents doivent également autoriser chaque outil.",
    )
    expected_version: int = Field(ge=1, description="Version de la salle lue avant modification.")


class RoomCreate(APIModel):
    name: str = Field(min_length=2, max_length=120, examples=["Conseil stratégique"])
    description: str = Field(default="", max_length=2_000)
    topic: str = Field(min_length=5, max_length=10_000)
    language: str = Field(default="fr", pattern=r"^[a-z]{2}(?:-[A-Z]{2})?$")
    mode: RoomMode = RoomMode.DEBATE
    temporal_mode: TemporalMode = TemporalMode.LIVE
    visibility: RoomVisibility = RoomVisibility.PRIVATE
    rules: str = Field(default="", max_length=10_000)
    tools: list[str] = Field(default_factory=list)
    budget_limit: Decimal = Field(gt=0, max_digits=12, decimal_places=4, examples=[25])
    max_messages: int | None = Field(
        default=None,
        ge=1,
        le=10_000,
        description="Champ historique accepté pour compatibilité. Les conversations ne sont plus plafonnées.",
    )
    max_duration_minutes: int = Field(default=60, ge=1, le=43_200)
    conversation_settings: ConversationSettings = Field(default_factory=ConversationSettings)
    participant_ids: list[UUID] = Field(min_length=2)

    @model_validator(mode="after")
    def participants_are_unique(self) -> "RoomCreate":
        if len(set(self.participant_ids)) != len(self.participant_ids):
            raise ValueError("Les participants doivent être uniques")
        return self


class ParticipantRead(APIModel):
    agent_id: UUID
    instructions: str
    is_active: bool


class RoomRead(APIModel):
    id: UUID
    workspace_id: UUID
    created_by_id: UUID
    name: str
    description: str
    topic: str
    language: str
    mode: RoomMode
    temporal_mode: TemporalMode
    visibility: RoomVisibility
    status: RoomStatus
    rules: str
    tools: list[str]
    budget_limit: Decimal
    amount_spent: Decimal
    max_messages: int | None
    max_duration_minutes: int
    cloud_tokens: int
    local_tokens: int
    version: int
    conversation_settings: ConversationSettings
    participants: list[ParticipantRead]
    started_at: datetime | None
    stopped_at: datetime | None
    created_at: datetime
    updated_at: datetime


class RoomStatusUpdate(APIModel):
    status: Literal[RoomStatus.RUNNING, RoomStatus.PAUSED, RoomStatus.STOPPED]
    expected_version: int = Field(ge=1)


class ParticipantUpdate(APIModel):
    present: bool
    instructions: str = Field(default="", max_length=4_000)
    expected_version: int = Field(ge=1)


class MessageCreate(APIModel):
    content: str = Field(min_length=1, max_length=50_000)
    reply_to_id: UUID | None = None
    thread_root_id: UUID | None = Field(
        default=None, description="Message racine du fil ; absent pour la conversation principale."
    )


class ReactionActorRead(APIModel):
    id: UUID
    display_name: str
    kind: Literal["user", "agent"]
    is_me: bool = False


class ReactionRead(APIModel):
    emoji: str
    count: int
    reacted_by_me: bool
    agent_ids: list[UUID] = Field(default_factory=list)
    actors: list[ReactionActorRead] = Field(
        default_factory=list,
        description="Au plus trois personnes ayant réagi, pour l'infobulle du client.",
    )


class MessageRead(APIModel):
    id: UUID
    room_id: UUID
    author_user_id: UUID | None
    author_agent_id: UUID | None
    reply_to_id: UUID | None
    thread_root_id: UUID | None = None
    kind: MessageKind
    content: str
    reactions: list[ReactionRead] = Field(default_factory=list)
    metadata: dict[str, object] = Field(default_factory=dict)
    created_at: datetime


class ReactionUpdate(APIModel):
    present: bool = True


class EventRead(APIModel):
    schema_version: Literal[1] = 1
    id: UUID
    room_id: UUID
    cursor: str
    occurred_at: datetime
    payload: dict[str, object]
