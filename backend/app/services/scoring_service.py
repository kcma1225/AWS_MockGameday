from datetime import datetime, timezone, timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.models.team import Team
from app.models.score_event import ScoreEvent
from app.models.event import Event


TREND_WINDOW_MINUTES = 1


async def recalculate_team_score(team_id: UUID, db: AsyncSession) -> float:
    """Sum all score events for a team and update the team record."""
    result = await db.execute(
        select(func.sum(ScoreEvent.points)).where(ScoreEvent.team_id == team_id)
    )
    total = result.scalar() or 0.0

    team_result = await db.execute(select(Team).where(Team.id == team_id))
    team = team_result.scalar_one_or_none()
    if team:
        team.score_total = total
        team.updated_at = datetime.now(timezone.utc)

    return total


async def recalculate_team_trend(team_id: UUID, db: AsyncSession) -> float:
    """Sum score events within the last TREND_WINDOW_MINUTES for trend."""
    window_start = datetime.now(timezone.utc) - timedelta(minutes=TREND_WINDOW_MINUTES)

    result = await db.execute(
        select(func.sum(ScoreEvent.points)).where(
            ScoreEvent.team_id == team_id,
            ScoreEvent.occurred_at >= window_start,
        )
    )
    trend = result.scalar() or 0.0

    team_result = await db.execute(select(Team).where(Team.id == team_id))
    team = team_result.scalar_one_or_none()
    if team:
        team.trend_value = trend

    return trend


async def recalculate_event_rankings(event_id: UUID, db: AsyncSession):
    """Recompute rank_cache for all teams in an event ordered by score."""
    result = await db.execute(
        select(Team)
        .where(Team.event_id == event_id, Team.is_active == True)
        .order_by(desc(Team.score_total))
    )
    teams = result.scalars().all()

    for rank, team in enumerate(teams, start=1):
        team.rank_cache = rank


async def apply_score_event(
    score_event: ScoreEvent,
    db: AsyncSession,
) -> Team:
    """Apply a score event to the team and update rankings."""
    team_id = score_event.team_id
    event_id = score_event.event_id

    await recalculate_team_score(team_id, db)
    await recalculate_team_trend(team_id, db)
    await recalculate_event_rankings(event_id, db)

    team_result = await db.execute(select(Team).where(Team.id == team_id))
    return team_result.scalar_one()


def _latency_to_points(latency_ms: float, config: dict | None = None) -> float:
    """Map latency to success points. Lower latency earns higher points."""
    # Base formula: roughly 10 points near instant response and decays with latency.
    points = 10 - (latency_ms / 200)
    return round(max(0.1, points), 2)


def build_http_score_event(
    event_id: UUID,
    team_id: UUID,
    module_id: UUID,
    module_name: str,
    latency_ms: float | None,
    status_code: int | None,
    error: str | None,
    config: dict | None = None,
) -> dict:
    """
    Build the fields for a ScoreEvent based on HTTP check result.
    Returns a dict of ScoreEvent fields (not persisted here).
    """
    import time

    now = datetime.now(timezone.utc)
    ts_ms = int(time.time() * 1000)

    if error:
        points = -5
        reason = f"Error checking endpoint: {error}"
        category = "penalty"
    elif status_code is None or status_code < 200 or status_code >= 300:
        points = -5
        reason = f"Invalid response status {status_code}"
        category = "penalty"
    elif latency_ms is not None:
        points = _latency_to_points(latency_ms, config)
        reason = f"Successful response with latency {latency_ms:.0f} ms"
        category = "score"
    else:
        points = 0
        reason = "No latency data"
        category = "info"

    return {
        "event_id": event_id,
        "team_id": team_id,
        "module_id": module_id,
        "timestamp_ms": ts_ms,
        "occurred_at": now,
        "points": points,
        "source": module_name,
        "reason": reason,
        "category": category,
        "metadata_json": {
            "latency_ms": latency_ms,
            "status_code": status_code,
            "error": error,
        },
    }
