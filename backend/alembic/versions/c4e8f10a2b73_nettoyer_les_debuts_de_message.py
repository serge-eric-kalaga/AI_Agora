"""nettoyer les débuts de message

Revision ID: c4e8f10a2b73
Revises: 7b1d6a5e3c20
Create Date: 2026-10-12 20:40:00
"""

import re
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c4e8f10a2b73"
down_revision: str | Sequence[str] | None = "7b1d6a5e3c20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            "SELECT messages.id, messages.content, agent_definitions.name "
            "FROM messages JOIN agent_definitions "
            "ON agent_definitions.id = messages.author_agent_id"
        )
    ).mappings()
    for row in rows:
        pattern = re.compile(
            rf"^\s*(?:\*\*)?{re.escape(row['name'])}(?:\*\*)?\s*:\s*", re.IGNORECASE
        )
        cleaned = pattern.sub("", row["content"], count=1).strip()
        if cleaned != row["content"]:
            connection.execute(
                sa.text("UPDATE messages SET content = :content WHERE id = :id"),
                {"content": cleaned, "id": row["id"]},
            )
    op.execute(
        "UPDATE agent_definitions "
        "SET generation_config = jsonb_set("
        "COALESCE(generation_config::jsonb, '{}'::jsonb), "
        "'{maxTokens}', '4096'::jsonb, true)::json "
        "WHERE COALESCE((generation_config->>'maxTokens')::integer, 0) < 4096"
    )


def downgrade() -> None:
    # Les préfixes redondants ne peuvent pas être reconstruits de façon fiable.
    pass
