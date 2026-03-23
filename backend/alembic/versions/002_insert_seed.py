"""Data insert stage (fixed slot)

Revision ID: 002
Revises: 001
Create Date: 2026-03-23
"""

from typing import Sequence, Union

from alembic import op


revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Fixed stage for seed data insertion.
    # Keep this file as the canonical place for initial data insert SQL/ops.
    op.execute("SELECT 1")


def downgrade() -> None:
    op.execute("SELECT 1")
