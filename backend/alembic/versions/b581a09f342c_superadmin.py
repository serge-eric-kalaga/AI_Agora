"""Privilège global, désactivé pour tous les comptes existants."""

from alembic import op
import sqlalchemy as sa

revision = "b581a09f342c"
down_revision = "a37f419cd802"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("is_superadmin", sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.alter_column("users", "is_superadmin", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "is_superadmin")
