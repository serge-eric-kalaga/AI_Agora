"""Ajouter la mémoire attribuée des salles.

Revision ID: a51c86d07e12
Revises: f27c51d8a604
"""

import sqlalchemy as sa

from alembic import op

revision = "a51c86d07e12"
down_revision = "f27c51d8a604"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "room_memories",
        sa.Column(
            "room_id", sa.Uuid(), sa.ForeignKey("rooms.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("state", sa.JSON(), nullable=False),
        sa.Column(
            "through_message_id",
            sa.Uuid(),
            sa.ForeignKey("messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("room_memories")
