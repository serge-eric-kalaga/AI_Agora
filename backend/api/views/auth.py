"""Routes d'inscription et de connexion."""

import hashlib
import re
import secrets
from datetime import timedelta, timezone

from fastapi import APIRouter, Form, Response, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError

from api.database.models import AuthSession, User, Workspace, WorkspaceMember, WorkspaceRole, utcnow
from api.dependencies import CurrentUser, DbSession
from api.errors import ConflictError, DomainError
from api.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UserRead
from api.security import create_access_token, hash_password, verify_password
from api.services.audit import record_audit

router = APIRouter(prefix="/auth", tags=["Authentification"])


def _token_for(user: User, db: DbSession, *, session_token: str | None = None) -> TokenResponse:
    # Une expiration absolue empêche une session renouvelée de durer indéfiniment.
    if session_token is None:
        session_token = secrets.token_urlsafe(48)
        db.add(
            AuthSession(
                user_id=user.id,
                token_hash=hashlib.sha256(session_token.encode()).hexdigest(),
                expires_at=utcnow() + timedelta(days=7),
            )
        )
        db.commit()
    token, expires_in = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        refresh_token=session_token,
        refresh_expires_in=7 * 86400,
        expires_in=expires_in,
        user=UserRead.model_validate(user),
    )


def _authenticate(db: DbSession, login: str, password: str) -> User:
    normalized = login.strip().lower()
    user = db.scalar(select(User).where(or_(User.email == normalized, User.username == normalized)))
    if not user or not verify_password(password, user.password_hash):
        raise DomainError("invalid_credentials", "Identifiant ou mot de passe incorrect.", 401)
    if not user.is_active:
        raise DomainError("inactive_user", "Ce compte est désactivé.", 403)
    return user


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un compte et son espace personnel",
    description="Crée atomiquement l'utilisateur, un espace de travail propriétaire et un jeton d'accès.",
)
def register(payload: RegisterRequest, db: DbSession) -> TokenResponse:
    username = payload.username.lower()
    base_slug = re.sub(r"[^a-z0-9]+", "-", username).strip("-") or "espace"
    user = User(
        email=str(payload.email).lower(),
        username=username,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.flush()
        slug = base_slug
        suffix = 1
        while db.scalar(select(Workspace.id).where(Workspace.slug == slug)):
            suffix += 1
            slug = f"{base_slug}-{suffix}"
        workspace = Workspace(name=f"Espace de {payload.username}", slug=slug, owner_id=user.id)
        db.add(workspace)
        db.flush()
        db.add(
            WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER)
        )
        record_audit(
            db,
            action="user.registered",
            resource_type="user",
            resource_id=user.id,
            actor_user_id=user.id,
            workspace_id=workspace.id,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            "account_already_exists", "Cet email ou ce nom d'utilisateur est déjà utilisé."
        ) from exc
    db.refresh(user)
    return _token_for(user, db)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Se connecter avec un corps JSON",
)
def login(payload: LoginRequest, db: DbSession) -> TokenResponse:
    return _token_for(_authenticate(db, payload.login, payload.password), db)


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Obtenir un jeton depuis Swagger OAuth2",
    description="Le champ username accepte aussi une adresse email.",
)
def swagger_token(
    db: DbSession,
    username: str = Form(),
    password: str = Form(),
) -> TokenResponse:
    return _token_for(_authenticate(db, username, password), db)


@router.get("/me", response_model=UserRead, summary="Lire le profil authentifié")
def me(current_user: CurrentUser) -> UserRead:
    return UserRead.model_validate(current_user)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Renouveler un accès sans ressaisir le mot de passe",
    description="Valide une session opaque de sept jours maximum. Le secret n'est stocké qu'en condensat SHA-256. Un compte désactivé ou une session expirée/révoquée est refusé. Le renouvellement concurrent reste idempotent et n'allonge pas l'expiration absolue.",
)
def refresh(payload: RefreshRequest, db: DbSession) -> TokenResponse:
    session = db.scalar(
        select(AuthSession).where(
            AuthSession.token_hash == hashlib.sha256(payload.refresh_token.encode()).hexdigest()
        )
    )
    expires = (
        session.expires_at.replace(tzinfo=timezone.utc)
        if session and session.expires_at.tzinfo is None
        else session.expires_at
        if session
        else None
    )
    user = db.get(User, session.user_id) if session else None
    if not session or not expires or expires <= utcnow() or not user or not user.is_active:
        raise DomainError(
            "session_expired", "Votre session a expiré. Veuillez vous reconnecter.", 401
        )
    result = _token_for(user, db, session_token=payload.refresh_token)
    result.refresh_expires_in = max(0, int((expires - utcnow()).total_seconds()))
    return result


@router.post(
    "/logout",
    status_code=204,
    summary="Révoquer une session",
    description="Supprime la session de renouvellement. Les accès JWT déjà émis expirent à leur échéance normale. L'appel est idempotent, y compris pour un secret inconnu.",
)
def logout(payload: RefreshRequest, db: DbSession) -> Response:
    session = db.scalar(
        select(AuthSession).where(
            AuthSession.token_hash == hashlib.sha256(payload.refresh_token.encode()).hexdigest()
        )
    )
    if session:
        db.delete(session)
        db.commit()
    return Response(status_code=204)
