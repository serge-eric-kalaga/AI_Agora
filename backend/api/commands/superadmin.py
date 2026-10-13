"""Créer un superadmin : python -m api.commands.superadmin.

Lit un objet JSON sur l'entrée standard (username, email, password). Aucun secret
n'est journalisé. Un compte existant n'est jamais promu ou réinitialisé en silence.
"""

import json
import sys

from sqlalchemy import or_, select

from api.database import SessionLocal
from api.database.models import User, Workspace, WorkspaceMember, WorkspaceRole
from api.schemas.auth import RegisterRequest
from api.security import hash_password
from api.services.audit import record_audit


def main() -> None:
    payload = RegisterRequest.model_validate(json.load(sys.stdin))
    username = payload.username.lower()
    email = str(payload.email).lower()
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(or_(User.username == username, User.email == email))):
            raise SystemExit("Compte existant : aucune modification effectuée.")
        user = User(
            username=username,
            email=email,
            password_hash=hash_password(payload.password),
            is_superadmin=True,
        )
        db.add(user)
        db.flush()
        workspace = Workspace(
            name="Administration AI Agora", slug=f"admin-{user.id.hex[:12]}", owner_id=user.id
        )
        db.add(workspace)
        db.flush()
        db.add(
            WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER)
        )
        record_audit(
            db,
            action="superadmin.provisioned",
            resource_type="user",
            resource_id=user.id,
            actor_user_id=user.id,
            workspace_id=workspace.id,
        )
        db.commit()
    print("Compte superadmin créé. Aucun email envoyé.")


if __name__ == "__main__":
    main()
