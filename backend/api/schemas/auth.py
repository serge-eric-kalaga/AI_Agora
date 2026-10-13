"""Contrats d'authentification documentes dans Swagger."""

from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, Field, field_validator

from .common import APIModel


class RegisterRequest(APIModel):
    email: EmailStr = Field(
        description="Adresse unique du compte.",
        examples=["explorateur@agora.example.com"],
    )
    username: str = Field(min_length=3, max_length=80, examples=["explorateur"])
    password: str = Field(
        min_length=12,
        max_length=128,
        description="Mot de passe brut. Il n'est jamais restitue ni journalise.",
        examples=["UnePhraseSecrete!2026"],
    )

    @field_validator("password")
    @classmethod
    def password_complexity(cls, value: str) -> str:
        if not any(char.isalpha() for char in value) or not any(char.isdigit() for char in value):
            raise ValueError("Le mot de passe doit contenir au moins une lettre et un chiffre")
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Le mot de passe ne doit pas dépasser 72 octets")
        return value


class LoginRequest(APIModel):
    login: str = Field(description="Adresse email ou nom d'utilisateur.", examples=["explorateur"])
    password: str = Field(min_length=1, max_length=128, examples=["UnePhraseSecrete!2026"])


class UserRead(APIModel):
    id: UUID
    email: EmailStr
    username: str
    is_active: bool
    is_superadmin: bool = Field(default=False, description="Accès global en lecture. Ce privilège ne peut pas être attribué par inscription ou édition de profil.")
    created_at: datetime


class RefreshRequest(APIModel):
    refresh_token: str = Field(
        min_length=40,
        max_length=128,
        description="Secret opaque de session. Réservé au serveur web ; jamais exposé au JavaScript.",
    )


class TokenResponse(APIModel):
    access_token: str = Field(description="Jeton JWT Bearer a envoyer dans Authorization.")
    token_type: str = "bearer"
    expires_in: int = Field(description="Duree de validite du jeton, en secondes.")
    refresh_token: str | None = Field(
        default=None, description="Secret de renouvellement, à conserver dans un cookie HttpOnly."
    )
    refresh_expires_in: int | None = Field(
        default=None, description="Expiration absolue de la session, en secondes."
    )
    user: UserRead
