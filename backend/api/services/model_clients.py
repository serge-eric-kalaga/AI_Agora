"""Appels bornés aux fournisseurs de modèles supportés par AI Agora."""

from dataclasses import dataclass
from typing import Any

import httpx

from api.database.models import ProviderConnection, ProviderKind
from api.security import decrypt_secret

from .providers import _validate_destination


class ModelProviderError(RuntimeError):
    """Erreur transitoire ou réponse invalide d'un fournisseur IA."""


@dataclass(frozen=True)
class ModelRequest:
    model: str
    system_prompt: str
    messages: list[dict[str, str]]
    temperature: float = 0.7
    max_tokens: int = 1024


@dataclass(frozen=True)
class ModelResult:
    content: str
    prompt_tokens: int
    completion_tokens: int


def _integer(value: object) -> int:
    return value if isinstance(value, int) and value >= 0 else 0


def _post(provider: ProviderConnection, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not provider.base_url:
        raise ModelProviderError("Aucune URL n'est configurée pour ce fournisseur.")
    _validate_destination(provider.base_url)
    headers: dict[str, str] = {"content-type": "application/json"}
    if provider.encrypted_api_key:
        headers["authorization"] = f"Bearer {decrypt_secret(provider.encrypted_api_key)}"
    try:
        with httpx.Client(timeout=90, follow_redirects=False) as client:
            response = client.post(f"{provider.base_url.rstrip('/')}{path}", headers=headers, json=payload)
        response.raise_for_status()
        body = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise ModelProviderError(f"Le fournisseur IA ne répond pas correctement: {type(exc).__name__}") from exc
    if not isinstance(body, dict):
        raise ModelProviderError("Le fournisseur IA a renvoyé un format inattendu.")
    return body


def generate_model_response(provider: ProviderConnection, request: ModelRequest) -> ModelResult:
    """Normalise Ollama et les API compatibles OpenAI vers un résultat commun."""

    messages = [{"role": "system", "content": request.system_prompt}, *request.messages]
    if provider.kind == ProviderKind.LOCAL:
        body = _post(
            provider,
            "/api/chat",
            {
                "model": request.model,
                "messages": messages,
                "stream": False,
                # Les modèles à raisonnement peuvent sinon consommer toute la limite sans réponse visible.
                "think": False,
                "options": {
                    "temperature": request.temperature,
                    "num_predict": request.max_tokens,
                },
            },
        )
        message = body.get("message")
        content = message.get("content") if isinstance(message, dict) else None
        prompt_tokens = _integer(body.get("prompt_eval_count"))
        completion_tokens = _integer(body.get("eval_count"))
    else:
        body = _post(
            provider,
            "/chat/completions",
            {
                "model": request.model,
                "messages": messages,
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
                "stream": False,
            },
        )
        choices = body.get("choices")
        first = choices[0] if isinstance(choices, list) and choices else None
        message = first.get("message") if isinstance(first, dict) else None
        content = message.get("content") if isinstance(message, dict) else None
        raw_usage = body.get("usage")
        usage: dict[str, Any] = raw_usage if isinstance(raw_usage, dict) else {}
        prompt_tokens = _integer(usage.get("prompt_tokens"))
        completion_tokens = _integer(usage.get("completion_tokens"))
    if not isinstance(content, str) or not content.strip():
        raise ModelProviderError("Le fournisseur IA n'a produit aucun contenu.")
    return ModelResult(content.strip(), prompt_tokens, completion_tokens)
