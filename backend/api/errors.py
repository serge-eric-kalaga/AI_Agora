"""Erreurs métier stables exposées aux clients de l'API."""

from typing import Any


class DomainError(Exception):
    """Erreur attendue avec code machine, message français et statut HTTP."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        *,
        fields: dict[str, list[str]] | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.fields = fields
        self.details = details or {}


class NotFoundError(DomainError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(code, message, 404)


class ConflictError(DomainError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(code, message, 409)
