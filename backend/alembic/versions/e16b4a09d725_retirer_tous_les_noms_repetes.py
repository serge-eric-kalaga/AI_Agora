"""retirer tous les noms répétés

Revision ID: e16b4a09d725
Revises: c4e8f10a2b73
Create Date: 2026-10-12 20:55:00
"""

import re
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e16b4a09d725"
down_revision: str | Sequence[str] | None = "c4e8f10a2b73"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    connection = op.get_bind()
    names = connection.execute(sa.text("SELECT name FROM agent_definitions")).scalars().all()
    rows = connection.execute(sa.text("SELECT id, content FROM messages")).mappings()
    for row in rows:
        cleaned = row["content"]
        for name in sorted(names, key=len, reverse=True):
            pattern = re.compile(
                rf"^\s*(?:\*\*)?{re.escape(name)}(?:\*\*)?\s*:\s*", re.IGNORECASE
            )
            cleaned = pattern.sub("", cleaned, count=1)
        cleaned = cleaned.strip()
        if cleaned != row["content"]:
            connection.execute(
                sa.text("UPDATE messages SET content = :content WHERE id = :id"),
                {"content": cleaned, "id": row["id"]},
            )


def downgrade() -> None:
    # Les préfixes redondants ne peuvent pas être reconstruits de façon fiable.
    pass
