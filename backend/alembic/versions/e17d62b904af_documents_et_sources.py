"""Documents joints et instantanés publics isolés par salle."""

from alembic import op
import sqlalchemy as sa

revision = "e17d62b904af"
down_revision = "d86fa7312c09"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "room_resources",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "room_id", sa.Uuid(), sa.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "created_by_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("url", sa.String(2000)),
        sa.Column("filename", sa.String(200)),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("original", sa.LargeBinary()),
        sa.Column("digest", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("room_id", "digest"),
    )
    op.create_index("ix_room_resources_room_id", "room_resources", ["room_id"])


def downgrade() -> None:
    op.drop_index("ix_room_resources_room_id", table_name="room_resources")
    op.drop_table("room_resources")
