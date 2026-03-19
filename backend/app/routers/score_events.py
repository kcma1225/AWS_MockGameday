from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional

from app.database import get_db
from app.deps import get_current_team_session
from app.models.score_event import ScoreEvent
from app.models.team import Team
from app.schemas.score_event import ScoreEventOut, ScoreEventPage

router = APIRouter()


@router.get("", response_model=ScoreEventPage)
async def list_score_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    source: Optional[str] = Query(None),
    min_points: Optional[float] = Query(None),
    max_points: Optional[float] = Query(None),
    category: Optional[str] = Query(None),
    session=Depends(get_current_team_session),
    db: AsyncSession = Depends(get_db),
):
    team_result = await db.execute(select(Team).where(Team.id == session.team_id))
    team = team_result.scalar_one()

    query = select(ScoreEvent).where(ScoreEvent.team_id == team.id)

    if source:
        query = query.where(ScoreEvent.source == source)
    if min_points is not None:
        query = query.where(ScoreEvent.points >= min_points)
    if max_points is not None:
        query = query.where(ScoreEvent.points <= max_points)
    if category:
        query = query.where(ScoreEvent.category == category)

    # Count total
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    # Get page
    items_result = await db.execute(
        query.order_by(desc(ScoreEvent.occurred_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = items_result.scalars().all()

    return ScoreEventPage(
        items=[
            ScoreEventOut(
                id=str(e.id),
                timestamp_ms=e.timestamp_ms,
                points=e.points,
                source=e.source,
                reason=e.reason,
                category=e.category,
                module_id=str(e.module_id) if e.module_id else None,
            )
            for e in items
        ],
        page=page,
        page_size=page_size,
        total=total,
    )
