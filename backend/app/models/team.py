import uuid
import base64
from datetime import datetime, timezone
from sqlalchemy import String, Float, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    public_team_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    encoded_team_id_base64: Mapped[str] = mapped_column(String(128), nullable=False)
    team_code_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    team_code_plaintext: Mapped[str | None] = mapped_column(String(64), nullable=True)
    team_name: Mapped[str] = mapped_column(String(128), nullable=False)
    score_total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    trend_value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    rank_cache: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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
    event: Mapped["Event"] = relationship("Event", back_populates="teams")  # noqa: F821
    participants: Mapped[list["Participant"]] = relationship("Participant", back_populates="team", lazy="select", passive_deletes=True)  # noqa: F821
    submissions: Mapped[list["Submission"]] = relationship("Submission", back_populates="team", lazy="select", passive_deletes=True)  # noqa: F821
    score_events: Mapped[list["ScoreEvent"]] = relationship("ScoreEvent", back_populates="team", lazy="select", passive_deletes=True)  # noqa: F821
    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="team", lazy="select", passive_deletes=True)  # noqa: F821

    @staticmethod
    def make_encoded_id(public_team_id: str) -> str:
        return base64.b64encode(public_team_id.encode()).decode()
