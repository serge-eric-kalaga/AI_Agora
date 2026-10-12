"""Connecteurs fournisseurs avec contrôle des destinations réseau."""

import ipaddress
import socket
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx

from api.configs import get_settings
from api.database.models import ProviderConnection
from api.errors import DomainError
from api.security import decrypt_secret


def _validate_destination(url: str) -> None:
    """Réduit le risque SSRF avant tout appel vers un endpoint configurable."""

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise DomainError("invalid_provider_url", "L'URL du fournisseur est invalide.")
    if parsed.username or parsed.password:
        raise DomainError("invalid_provider_url", "Les identifiants intégrés à l'URL sont interdits.")
    if get_settings().allow_private_provider_endpoints:
        return
    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(parsed.hostname, parsed.port or 443)}
    except socket.gaierror as exc:
        raise DomainError("provider_unreachable", "Le nom d'hôte du fournisseur est introuvable.", 422) from exc
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if not ip.is_global:
            raise DomainError(
                "private_provider_forbidden",
                "Les endpoints privés sont désactivés sur cet environnement.",
                422,
            )


async def test_provider(provider: ProviderConnection) -> tuple[bool, str, list[str], datetime]:
    if not provider.base_url:
        return False, "Aucune URL de base n'est configurée.", [], datetime.now(timezone.utc)
    _validate_destination(provider.base_url)
    headers: dict[str, str] = {}
    if provider.encrypted_api_key:
        headers["Authorization"] = f"Bearer {decrypt_secret(provider.encrypted_api_key)}"
    url = provider.base_url.rstrip("/")
    path = "/api/tags" if provider.kind.value == "local" else "/models"
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
            response = await client.get(f"{url}{path}", headers=headers)
        response.raise_for_status()
        body = response.json()
        raw_models = body.get("models", []) if isinstance(body, dict) else []
        models = [
            str(item.get("id") or item.get("name"))
            for item in raw_models
            if isinstance(item, dict) and (item.get("id") or item.get("name"))
        ]
        return True, "Connexion au fournisseur réussie.", models, datetime.now(timezone.utc)
    except (httpx.HTTPError, ValueError) as exc:
        return False, f"Échec de connexion: {type(exc).__name__}", [], datetime.now(timezone.utc)
