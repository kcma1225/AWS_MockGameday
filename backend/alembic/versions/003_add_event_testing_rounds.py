"""add event testing rounds config

Revision ID: 003
Revises: 002
Create Date: 2026-03-19
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("events", sa.Column("testing_rounds", sa.JSON(), nullable=True))
    op.execute(
        """
        UPDATE events
        SET testing_rounds = '[
          {"name": "Warmup", "requests_per_second": 1, "duration_seconds": 1},
          {"name": "Qualification", "requests_per_second": 5, "duration_seconds": 10},
          {"name": "Pressure", "requests_per_second": 10, "duration_seconds": 20}
        ]'::json
        WHERE testing_rounds IS NULL
        """
    )
    op.alter_column("events", "testing_rounds", nullable=False)


def downgrade() -> None:
    op.drop_column("events", "testing_rounds")
