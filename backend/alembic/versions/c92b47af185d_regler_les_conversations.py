"""Rythme et autonomie persistants des conversations."""

from alembic import op
import sqlalchemy as sa

revision = "c92b47af185d"
down_revision = "a51c86d07e12"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "rooms",
        sa.Column(
            "conversation_settings", sa.JSON(), nullable=False, server_default=sa.text("'{}'")
        ),
    )
    op.alter_column("rooms", "conversation_settings", server_default=None)


def downgrade() -> None:
    op.drop_column("rooms", "conversation_settings")
