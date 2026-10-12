"""Hachage des mots de passe, jetons JWT et chiffrement des secrets."""

import base64
import hashlib
from datetime import datetime, timedelta, timezone
from uuid import UUID

import bcrypt
import jwt
from cryptography.fernet import Fernet, InvalidToken

from api.configs import Settings, get_settings
from api.errors import DomainError


def hash_password(password: str) -> str:
    """Produit un hachage bcrypt salé; aucun mot de passe brut n'est journalisé."""

    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: UUID, settings: Settings | None = None) -> tuple[str, int]:
    config = settings or get_settings()
    lifetime = timedelta(minutes=config.access_token_expire_minutes)
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "type": "access", "iat": now, "exp": now + lifetime}
    token = jwt.encode(
        payload,
        config.jwt_secret.get_secret_value(),
        algorithm=config.jwt_algorithm,
    )
    return token, int(lifetime.total_seconds())


def decode_access_token(token: str, settings: Settings | None = None) -> UUID:
    config = settings or get_settings()
    try:
        payload = jwt.decode(
            token,
            config.jwt_secret.get_secret_value(),
            algorithms=[config.jwt_algorithm],
        )
        if payload.get("type") != "access":
            raise DomainError("invalid_token", "Le jeton fourni n'est pas un jeton d'accès.", 401)
        return UUID(payload["sub"])
    except DomainError:
        raise
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise DomainError("invalid_token", "Le jeton est invalide ou expiré.", 401) from exc


def _fernet(settings: Settings | None = None) -> Fernet:
    config = settings or get_settings()
    if config.credential_encryption_key:
        key = config.credential_encryption_key.get_secret_value().encode()
    else:
        # Repli réservé au développement; la production exige une clé explicite.
        digest = hashlib.sha256(config.jwt_secret.get_secret_value().encode()).digest()
        key = base64.urlsafe_b64encode(digest)
    try:
        return Fernet(key)
    except (ValueError, TypeError) as exc:
        raise RuntimeError("CREDENTIAL_ENCRYPTION_KEY doit être une clé Fernet valide") from exc


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise RuntimeError("Impossible de déchiffrer le secret fournisseur") from exc
