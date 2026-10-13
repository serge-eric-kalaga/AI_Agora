"""Un seul appel au modèle choisit l'action et rédige son éventuel message."""

from collections.abc import Callable
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, model_validator

from api.database.models import ProviderConnection
from api.services.model_clients import (
    ModelProviderError,
    ModelRequest,
    ModelResult,
    generate_model_response,
)


class ConversationAction(BaseModel):
    action: Literal["reply", "initiative", "reaction", "silence"]
    content: str = Field(max_length=8000)
    emoji: Literal["👍", "❤️", "🎯", "🤔"] | None

    @model_validator(mode="after")
    def consistent(self) -> "ConversationAction":
        if self.action in {"reply", "initiative"} and not self.content.strip():
            raise ValueError("Une prise de parole doit contenir du texte.")
        if self.action == "reaction" and not self.emoji:
            raise ValueError("Une réaction doit choisir un emoji autorisé.")
        return self


def choose_action(
    provider: ProviderConnection,
    request: ModelRequest,
    generator: Callable[[ProviderConnection, ModelRequest], ModelResult] = generate_model_response,
) -> tuple[ConversationAction, ModelResult]:
    instruction = "Choisis librement le mouvement pertinent : reply pour répondre, initiative pour introduire un angle utile lié au sujet, reaction pour un emoji suffisant, silence si tu n'as rien à ajouter. Ne paraphrase pas systématiquement le précédent message. Une réaction ou un silence laisse un autre participant reprendre. N'ajoute pas une question artificielle pour finir. Renvoie uniquement l'objet JSON demandé ; content est vide pour reaction/silence, emoji est null sauf pour reaction."
    structured = ModelRequest(
        request.model,
        request.system_prompt,
        [*request.messages, {"role": "user", "content": instruction}],
        request.temperature,
        max(request.max_tokens, 768),
        ConversationAction.model_json_schema(),
    )
    result = generator(provider, structured)
    try:
        if result.truncated:
            raise ValueError("Sortie incomplète")
        action = ConversationAction.model_validate_json(result.content)
    except (ValueError, ValidationError) as exc:
        raise ModelProviderError(
            "Décision conversationnelle invalide ou incomplète.",
            code="invalid_conversation_action",
            retryable=True,
        ) from exc
    return action, ModelResult(action.content, result.prompt_tokens, result.completion_tokens)
