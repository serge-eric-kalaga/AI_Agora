"""Routes d'inscription et de connexion."""

import re

from fastapi import APIRouter, Form, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError

from api.database.models import User, Workspace, WorkspaceMember, WorkspaceRole
from api.dependencies import CurrentUser, DbSession
from api.errors import ConflictError, DomainError
from api.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserRead
from api.security import create_access_token, hash_password, verify_password
from api.services.audit import record_audit

router = APIRouter(prefix="/auth", tags=["Authentification"])


def _token_for(user: User) -> TokenResponse:
    token, expires_in = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
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
    user = User(email=str(payload.email).lower(), username=username, password_hash=hash_password(payload.password))
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
        db.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER))
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
        raise ConflictError("account_already_exists", "Cet email ou ce nom d'utilisateur est déjà utilisé.") from exc
    db.refresh(user)
    return _token_for(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Se connecter avec un corps JSON",
)
def login(payload: LoginRequest, db: DbSession) -> TokenResponse:
    return _token_for(_authenticate(db, payload.login, payload.password))


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
    return _token_for(_authenticate(db, username, password))


@router.get("/me", response_model=UserRead, summary="Lire le profil authentifié")
def me(current_user: CurrentUser) -> UserRead:
    return UserRead.model_validate(current_user)
