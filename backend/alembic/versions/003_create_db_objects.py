"""Create DB objects stage (indexes/views/functions/triggers)

Revision ID: 003
Revises: 002
Create Date: 2026-03-23
"""

from typing import Sequence, Union

from alembic import op


revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Indexes (non-table core objects) are centralized in this stage.
    op.create_index("ix_teams_event_id", "teams", ["event_id"])
    op.create_index("ix_teams_public_team_id", "teams", ["public_team_id"])
    op.create_index("ix_participants_team_id", "participants", ["team_id"])
    op.create_index("ix_modules_event_id", "modules", ["event_id"])
    op.create_index("ix_submissions_team_id", "submissions", ["team_id"])
    op.create_index("ix_submissions_module_id", "submissions", ["module_id"])
    op.create_index("ix_score_events_event_id", "score_events", ["event_id"])
    op.create_index("ix_score_events_team_id", "score_events", ["team_id"])
    op.create_index("ix_score_events_occurred_at", "score_events", ["occurred_at"])
    op.create_index("ix_sessions_team_id", "sessions", ["team_id"])
    op.create_index("ix_sessions_token_hash", "sessions", ["token_hash"])
    op.create_index("ix_shared_folder_files_event_id", "shared_folder_files", ["event_id"])


def downgrade() -> None:
    op.drop_index("ix_shared_folder_files_event_id", table_name="shared_folder_files")
    op.drop_index("ix_sessions_token_hash", table_name="sessions")
    op.drop_index("ix_sessions_team_id", table_name="sessions")
    op.drop_index("ix_score_events_occurred_at", table_name="score_events")
    op.drop_index("ix_score_events_team_id", table_name="score_events")
    op.drop_index("ix_score_events_event_id", table_name="score_events")
    op.drop_index("ix_submissions_module_id", table_name="submissions")
    op.drop_index("ix_submissions_team_id", table_name="submissions")
    op.drop_index("ix_modules_event_id", table_name="modules")
    op.drop_index("ix_participants_team_id", table_name="participants")
    op.drop_index("ix_teams_public_team_id", table_name="teams")
    op.drop_index("ix_teams_event_id", table_name="teams")
