"""retirer les mentions de simulation

Revision ID: 7b1d6a5e3c20
Revises: 42d4d22d1af0
Create Date: 2026-10-12 20:15:00
"""

from collections.abc import Sequence

from alembic import op

revision: str = "7b1d6a5e3c20"
down_revision: str | Sequence[str] | None = "42d4d22d1af0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pattern = r"\s*\(simulation( analytique)?\)"
    op.execute(
        f"UPDATE agent_definitions SET name = btrim(regexp_replace(name, '{pattern}', '', 'gi')) "
        f"WHERE name ~* '{pattern}'"
    )
    op.execute(
        f"UPDATE messages SET content = btrim(regexp_replace(content, '{pattern}', '', 'gi')) "
        f"WHERE content ~* '{pattern}'"
    )


def downgrade() -> None:
    # Une mention éditoriale supprimée ne peut pas être reconstituée fidèlement.
    pass
