"""ajouter les réactions des agents

Revision ID: f27c51d8a604
Revises: e16b4a09d725
Create Date: 2026-10-12 21:30:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f27c51d8a604"
down_revision: str | Sequence[str] | None = "e16b4a09d725"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("message_reactions", "user_id", existing_type=sa.Uuid(), nullable=True)
    op.add_column("message_reactions", sa.Column("agent_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_message_reactions_agent_id",
        "message_reactions",
        "agent_definitions",
        ["agent_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint(
        "uq_message_reactions_agent_emoji",
        "message_reactions",
        ["message_id", "agent_id", "emoji"],
    )
    op.create_check_constraint(
        "ck_message_reaction_single_actor",
        "message_reactions",
        "(user_id IS NOT NULL AND agent_id IS NULL) OR "
        "(user_id IS NULL AND agent_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_message_reaction_single_actor", "message_reactions", type_="check"
    )
    op.drop_constraint(
        "uq_message_reactions_agent_emoji", "message_reactions", type_="unique"
    )
    op.drop_constraint(
        "fk_message_reactions_agent_id", "message_reactions", type_="foreignkey"
    )
    op.drop_column("message_reactions", "agent_id")
    op.alter_column("message_reactions", "user_id", existing_type=sa.Uuid(), nullable=False)
