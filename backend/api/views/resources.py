"""Import de pièces jointes et sources, isolé par salle et espace."""

from pathlib import PurePath
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, File, Response, UploadFile
from sqlalchemy import select

from api.database.models import Room, RoomResource
from api.dependencies import (
    CurrentUser,
    DbSession,
    require_workspace_editor,
    require_workspace_member,
)
from api.errors import NotFoundError
from api.schemas.common import Page
from api.schemas.resources import ResourceDetailRead, ResourceRead, SourceCreate
from api.services.audit import record_audit
from api.services.events import append_room_event
from api.services.resources import MAX_FILE_BYTES, extract_document, fetch_source, resource_digest

from .rooms import _room

router = APIRouter(
    prefix="/workspaces/{workspace_id}/rooms/{room_id}/resources", tags=["Documents et sources"]
)


def _read(resource: RoomResource) -> ResourceRead:
    return ResourceRead(
        id=resource.id,
        room_id=resource.room_id,
        kind=resource.kind,
        title=resource.title,
        url=resource.url,
        filename=resource.filename,
        excerpt=resource.content[:400],
        created_at=resource.created_at,
    )


def _save(db: DbSession, workspace_id: UUID, resource: RoomResource) -> ResourceRead:
    # Sérialiser la déduplication par salle, sans garder le verrou pendant le téléchargement.
    db.scalar(select(Room).where(Room.id == resource.room_id).with_for_update())
    existing = db.scalar(
        select(RoomResource).where(
            RoomResource.room_id == resource.room_id, RoomResource.digest == resource.digest
        )
    )
    if existing:
        return _read(existing)
    db.add(resource)
    db.flush()
    append_room_event(
        db,
        resource.room_id,
        "resource.added",
        {"resourceId": str(resource.id)},
        actor_user_id=resource.created_by_id,
    )
    record_audit(
        db,
        action="room.resource.added",
        resource_type="resource",
        resource_id=resource.id,
        actor_user_id=resource.created_by_id,
        workspace_id=workspace_id,
    )
    db.commit()
    return _read(resource)


@router.get(
    "",
    response_model=Page[ResourceRead],
    summary="Lister les documents et sources d’une salle",
    description="Métadonnées et aperçu uniquement. Les contenus complets sont lus à la demande ; seuls les membres de l’espace ont accès.",
)
def list_resources(
    workspace_id: UUID, room_id: UUID, db: DbSession, current_user: CurrentUser
) -> Page[ResourceRead]:
    require_workspace_member(db, workspace_id, current_user)
    _room(db, workspace_id, room_id)
    rows = db.scalars(
        select(RoomResource)
        .where(RoomResource.room_id == room_id)
        .order_by(RoomResource.created_at.desc())
    ).all()
    return Page(items=[_read(row) for row in rows])


@router.post(
    "/documents",
    response_model=ResourceRead,
    summary="Joindre un PDF ou un texte",
    description="Multipart : champ `file`. PDF textuel non chiffré (100 pages maximum), TXT ou Markdown UTF-8 ; taille maximale 5 Mo et 200 000 caractères extraits. Les scans sans texte sont refusés. Le fichier original est conservé pour téléchargement, jamais exécuté. Les imports identiques dans une salle sont dédupliqués. Réservé aux membres pouvant écrire.",
)
def upload_document(
    workspace_id: UUID,
    room_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> ResourceRead:
    require_workspace_editor(db, workspace_id, current_user)
    _room(db, workspace_id, room_id)
    data = file.file.read(MAX_FILE_BYTES + 1)
    filename = PurePath((file.filename or "document.txt").replace("\\", "/")).name[:200]
    content = extract_document(data, filename)
    return _save(
        db,
        workspace_id,
        RoomResource(
            room_id=room_id,
            created_by_id=current_user.id,
            kind="document",
            title=filename,
            filename=filename,
            content=content,
            original=data,
            digest=resource_digest(b"document:" + data),
        ),
    )


@router.post(
    "/sources",
    response_model=ResourceRead,
    summary="Consulter et joindre une source publique",
    description="Télécharge un instantané HTML, TXT ou PDF, limité à 1 Mo et quatre requêtes. Chaque destination est vérifiée ; adresse publique épinglée, Host/SNI conservés, pas de proxy d’environnement. La source garde son URL finale et sa date de consultation. Les agents ne voient que des extraits si la salle ET leur profil autorisent l’outil web. Aucun historique de conversation n’est envoyé au site consulté.",
)
def add_source(
    workspace_id: UUID,
    room_id: UUID,
    payload: SourceCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> ResourceRead:
    require_workspace_editor(db, workspace_id, current_user)
    _room(db, workspace_id, room_id)
    url, title, content = fetch_source(str(payload.url))
    return _save(
        db,
        workspace_id,
        RoomResource(
            room_id=room_id,
            created_by_id=current_user.id,
            kind="source",
            title=title,
            url=url,
            content=content,
            digest=resource_digest((url + "\n" + content).encode()),
        ),
    )


def _resource(db: DbSession, room_id: UUID, resource_id: UUID) -> RoomResource:
    resource = db.get(RoomResource, resource_id)
    if not resource or resource.room_id != room_id:
        raise NotFoundError("resource_not_found", "Le document est introuvable dans cette salle.")
    return resource


@router.get(
    "/{resource_id}",
    response_model=ResourceDetailRead,
    summary="Lire le contenu extrait et sa provenance",
)
def read_resource(
    workspace_id: UUID, room_id: UUID, resource_id: UUID, db: DbSession, current_user: CurrentUser
) -> ResourceDetailRead:
    require_workspace_member(db, workspace_id, current_user)
    _room(db, workspace_id, room_id)
    resource = _resource(db, room_id, resource_id)
    return ResourceDetailRead(**_read(resource).model_dump(), content=resource.content)


@router.get(
    "/{resource_id}/download",
    summary="Télécharger la pièce jointe originale",
    description="Réponse binaire forcée en pièce jointe, après contrôle des droits. Les sources web ont seulement un instantané textuel téléchargeable.",
)
def download_resource(
    workspace_id: UUID, room_id: UUID, resource_id: UUID, db: DbSession, current_user: CurrentUser
) -> Response:
    require_workspace_member(db, workspace_id, current_user)
    _room(db, workspace_id, room_id)
    resource = _resource(db, room_id, resource_id)
    return Response(
        content=resource.original or resource.content.encode(),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(resource.filename or resource.title + '.txt', safe='')}",
            "X-Content-Type-Options": "nosniff",
        },
    )
