from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone

from app.database import get_db
from app.deps import get_current_team_session
from app.models.team import Team
from app.models.event import Event
from app.models.score_event import ScoreEvent
from app.schemas.score_event import ScoreboardOut, ScoreboardRow

router = APIRouter()


@router.get("", response_model=ScoreboardOut)
async def get_scoreboard(
    session=Depends(get_current_team_session),
    db: AsyncSession = Depends(get_db),
):
    team_result = await db.execute(select(Team).where(Team.id == session.team_id))
    team = team_result.scalar_one()

    event_result = await db.execute(select(Event).where(Event.id == team.event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if not event.scoreboard_public:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Scoreboard is not available for this event",
        )

    # Get all teams in event
    teams_result = await db.execute(
        select(Team)
        .where(Team.event_id == team.event_id, Team.is_active == True)
        .order_by(desc(Team.score_total))
    )
    all_teams = teams_result.scalars().all()

    # Get last score time per team
    last_scores = {}
    for t in all_teams:
        last_result = await db.execute(
            select(ScoreEvent.occurred_at)
            .where(ScoreEvent.team_id == t.id)
            .order_by(desc(ScoreEvent.occurred_at))
            .limit(1)
        )
        last_scores[str(t.id)] = last_result.scalar_one_or_none()

    rows = []
    for rank_idx, t in enumerate(all_teams, start=1):
        rows.append(
            ScoreboardRow(
                rank=t.rank_cache or rank_idx,
                team_name=t.team_name,
                public_team_id=t.public_team_id,
                score_total=t.score_total,
                trend_value=t.trend_value,
                is_current_team=(t.id == team.id),
                is_active=t.is_active,
                last_score_at=last_scores.get(str(t.id)),
            )
        )

    return ScoreboardOut(
        updated_at=datetime.now(timezone.utc),
        rows=rows,
    )
