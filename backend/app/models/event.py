import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Enum as SAEnum, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base

import enum


class EventStatus(str, enum.Enum):
    draft = "draft"
    live = "live"
    paused = "paused"
    ended = "ended"


def default_testing_rounds() -> list[dict[str, int | str]]:
    return [
        {"name": "Warmup", "requests_per_second": 1, "duration_seconds": 1},
        {"name": "Qualification", "requests_per_second": 5, "duration_seconds": 10},
        {"name": "Pressure", "requests_per_second": 10, "duration_seconds": 20},
    ]


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    public_event_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[EventStatus] = mapped_column(
        SAEnum(EventStatus, name="event_status"), default=EventStatus.draft, nullable=False
    )
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)
    readme_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    runbook_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    scoreboard_public: Mapped[bool] = mapped_column(default=True, nullable=False)
    show_aws_console_button: Mapped[bool] = mapped_column(default=False, nullable=False)
    show_ssh_key_button: Mapped[bool] = mapped_column(default=False, nullable=False)
    testing_rounds: Mapped[list[dict[str, int | str]]] = mapped_column(
        JSON, default=default_testing_rounds, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    teams: Mapped[list["Team"]] = relationship("Team", back_populates="event", lazy="select", passive_deletes=True)  # noqa: F821
    modules: Mapped[list["Module"]] = relationship("Module", back_populates="event", lazy="select", passive_deletes=True)  # noqa: F821
    score_events: Mapped[list["ScoreEvent"]] = relationship("ScoreEvent", back_populates="event", lazy="select", passive_deletes=True)  # noqa: F821
    created_by: Mapped["AdminUser | None"] = relationship("AdminUser", lazy="select")  # noqa: F821
