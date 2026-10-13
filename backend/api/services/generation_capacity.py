"""Baux Redis renouvelables pour les salles et la capacité des serveurs locaux."""

import hashlib
import logging
from collections.abc import Generator
from contextlib import contextmanager
from threading import Event, Thread

from redis import Redis
from redis.exceptions import LockError, RedisError
from redis.lock import Lock

from api.configs import get_settings
from api.database.models import ProviderConnection, ProviderKind

logger = logging.getLogger(__name__)


class LocalProviderBusy(RuntimeError):
    """La capacité locale est occupée ; attendre ne constitue pas un échec du modèle."""


@contextmanager
def renewed_lease(lock: Lock, seconds: int) -> Generator[None, None, None]:
    """Renouvelle un bail acquis, avec le même jeton dans le thread de maintenance."""

    stopped = Event()

    def renew() -> None:
        while not stopped.wait(max(1, seconds / 3)):
            try:
                lock.extend(seconds, replace_ttl=True)
            except (LockError, RedisError):
                logger.exception("Le bail de génération ne peut plus être renouvelé")
                # Le worker ne doit pas continuer avec une propriété qu'il a perdue.
                stopped.set()

    heartbeat = Thread(target=renew, name="agora-generation-lease", daemon=True)
    heartbeat.start()
    try:
        yield
        if stopped.is_set():
            raise LocalProviderBusy("Bail de génération perdu ; le tour sera repris.")
    finally:
        stopped.set()
        heartbeat.join(timeout=2)
        try:
            lock.release()
        except (LockError, RedisError):
            logger.warning("Bail déjà perdu lors de sa libération")


@contextmanager
def local_generation_slot(provider: ProviderConnection) -> Generator[None, None, None]:
    """Partage la capacité entre tous les workers et espaces utilisant le même endpoint."""

    if provider.kind != ProviderKind.LOCAL:
        yield
        return
    settings = get_settings()
    # Ne pas exposer l'URL du fournisseur dans les clés Redis ou les journaux.
    endpoint = (provider.base_url or "").rstrip("/").casefold()
    key = hashlib.sha256(endpoint.encode()).hexdigest()
    client = Redis.from_url(settings.redis_url)
    try:
        for index in range(settings.local_provider_concurrency):
            lock = client.lock(
                f"ai-agora:local-capacity:{key}:{index}",
                timeout=settings.room_turn_lock_seconds,
                thread_local=False,
            )
            if lock.acquire(blocking=False):
                with renewed_lease(lock, settings.room_turn_lock_seconds):
                    yield
                return
        raise LocalProviderBusy("Toutes les places du serveur local sont occupées.")
    finally:
        client.close()
