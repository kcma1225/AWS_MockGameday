"""Initial schema with all tables and fields

Revision ID: 001
Revises: 
Create Date: 2026-03-12

All tables created in one migration for clean restart workflow.
Includes base schema plus feature toggles and shared folder support.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # admin_users
    op.create_table(
        "admin_users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(256), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(256), nullable=False),
        sa.Column("display_name", sa.String(128), nullable=False),
        sa.Column("role", sa.String(32), nullable=False, server_default="organizer"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )

    # events (with all feature toggles)
    op.create_table(
        "events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("public_event_id", sa.String(64), nullable=False, unique=True),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("slug", sa.String(128), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "status",
            sa.Enum("draft", "live", "paused", "ended", name="event_status"),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="UTC"),
        sa.Column("readme_markdown", sa.Text, nullable=True),
        sa.Column("runbook_markdown", sa.Text, nullable=True),
        sa.Column("created_by_admin_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True),
        # Feature toggles
        sa.Column("scoreboard_public", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("root_url_detection_enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("shared_folder_enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("show_aws_console_button", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("show_ssh_key_button", sa.Boolean, nullable=False, server_default="false"),
        # Testing configuration
        sa.Column(
            "testing_rounds",
            sa.JSON(),
            nullable=False,
            server_default=sa.text(
                "'[{\"name\": \"Warmup\", \"requests_per_second\": 1, \"duration_seconds\": 1}, "
                "{\"name\": \"Qualification\", \"requests_per_second\": 5, \"duration_seconds\": 10}, "
                "{\"name\": \"Pressure\", \"requests_per_second\": 10, \"duration_seconds\": 20}]'::json"
            ),
        ),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # teams (with plaintext login code for admin visibility)
    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("public_team_id", sa.String(64), nullable=False),
        sa.Column("encoded_team_id_base64", sa.String(128), nullable=False),
        sa.Column("team_code_hash", sa.String(256), nullable=False),
        sa.Column("team_code_plaintext", sa.String(64), nullable=True),
        sa.Column("challenge_token", sa.String(128), nullable=False, unique=True),
        sa.Column("team_name", sa.String(128), nullable=False),
        sa.Column("score_total", sa.Float, nullable=False, server_default="0"),
        sa.Column("trend_value", sa.Float, nullable=False, server_default="0"),
        sa.Column("rank_cache", sa.Integer, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # participants
    op.create_table(
        "participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("display_name", sa.String(128), nullable=False),
        sa.Column("email", sa.String(256), nullable=True),
        sa.Column(
            "role",
            sa.Enum("player", "captain", "judge", "admin", name="participant_role"),
            nullable=False,
            server_default="player",
        ),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # modules
    op.create_table(
        "modules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("key", sa.String(64), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("input_schema_json", postgresql.JSONB, nullable=True),
        sa.Column("evaluator_type", sa.String(64), nullable=False, server_default="http_latency"),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # submissions
    op.create_table(
        "submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("module_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("modules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("input_value", sa.String(2048), nullable=False),
        sa.Column("normalized_value", sa.String(2048), nullable=True),
        sa.Column(
            "validation_status",
            sa.Enum("pending", "accepted", "rejected", "error", name="validation_status"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("response_metadata_json", postgresql.JSONB, nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # score_events
    op.create_table(
        "score_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("module_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("modules.id", ondelete="SET NULL"), nullable=True),
        sa.Column("timestamp_ms", sa.BigInteger, nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("points", sa.Float, nullable=False),
        sa.Column("source", sa.String(128), nullable=False),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column("category", sa.String(64), nullable=False, server_default="score"),
        sa.Column("metadata_json", postgresql.JSONB, nullable=True),
    )

    # sessions
    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(256), nullable=False),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )

    # shared_folder_files (for admin file sharing with teams)
    op.create_table(
        "shared_folder_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("original_filename", sa.String(512), nullable=False),
        sa.Column("stored_filename", sa.String(512), nullable=False, unique=True),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(128), nullable=False),
        sa.Column("uploaded_by_admin_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("shared_folder_files")
    op.drop_table("sessions")
    op.drop_table("score_events")
    op.drop_table("submissions")
    op.drop_table("modules")
    op.drop_table("participants")
    op.drop_table("teams")
    op.drop_table("events")
    op.drop_table("admin_users")
    op.execute("DROP TYPE IF EXISTS event_status")
    op.execute("DROP TYPE IF EXISTS participant_role")
    op.execute("DROP TYPE IF EXISTS validation_status")
