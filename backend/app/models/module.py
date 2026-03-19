import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database import Base


class Module(Base):
    __tablename__ = "modules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    input_schema_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    evaluator_type: Mapped[str] = mapped_column(String(64), default="http_latency", nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    event: Mapped["Event"] = relationship("Event", back_populates="modules")  # noqa: F821
    submissions: Mapped[list["Submission"]] = relationship("Submission", back_populates="module", lazy="select", passive_deletes=True)  # noqa: F821
    score_events: Mapped[list["ScoreEvent"]] = relationship("ScoreEvent", back_populates="module", lazy="select", passive_deletes=True)  # noqa: F821
