"""Crée les alertes dans la transaction du message, sans envoi externe."""

import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from api.database.models import Message, Notification, Room, User, WorkspaceMember


def notify_message(db: Session, room: Room, message: Message) -> None:
    recipients: dict[UUID, str] = {}
    reply = db.get(Message, message.reply_to_id) if message.reply_to_id else None
    if reply and reply.room_id == room.id and reply.author_user_id:
        recipients[reply.author_user_id] = "reply"
    members = db.scalars(
        select(User)
        .join(WorkspaceMember, WorkspaceMember.user_id == User.id)
        .where(WorkspaceMember.workspace_id == room.workspace_id, User.is_active.is_(True))
    ).all()
    for user in members:
        if re.search(
            r"(?<![\w@])@" + re.escape(user.username) + r"(?![\w-])", message.content, re.IGNORECASE
        ):
            recipients[user.id] = "mention"
    member_ids = {user.id for user in members}
    for user_id, kind in recipients.items():
        if user_id in member_ids and user_id != message.author_user_id:
            db.add(
                Notification(
                    workspace_id=room.workspace_id,
                    user_id=user_id,
                    message_id=message.id,
                    kind=kind,
                )
            )
