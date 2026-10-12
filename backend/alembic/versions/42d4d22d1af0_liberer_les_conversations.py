"""liberer les conversations

Revision ID: 42d4d22d1af0
Revises: 8a4891dc2375
Create Date: 2026-10-12 19:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "42d4d22d1af0"
down_revision: str | Sequence[str] | None = "8a4891dc2375"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("rooms", "max_messages", existing_type=sa.Integer(), nullable=True)
    op.execute("UPDATE rooms SET max_messages = NULL")


def downgrade() -> None:
    op.execute("UPDATE rooms SET max_messages = 100 WHERE max_messages IS NULL")
    op.alter_column("rooms", "max_messages", existing_type=sa.Integer(), nullable=False)
