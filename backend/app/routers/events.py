from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.deps import get_current_team_session
from app.models.event import Event
from app.models.team import Team
from app.schemas.event import EventOut
from app.schemas.team import TeamDashboard

router = APIRouter()


@router.get("/current", response_model=EventOut)
async def get_current_event(
    session=Depends(get_current_team_session),
    db: AsyncSession = Depends(get_db),
):
    team_result = await db.execute(select(Team).where(Team.id == session.team_id))
    team = team_result.scalar_one()

    event_result = await db.execute(select(Event).where(Event.id == team.event_id))
    event = event_result.scalar_one()

    return EventOut(
        id=str(event.id),
        public_event_id=event.public_event_id,
        title=event.title,
        slug=event.slug,
        description=event.description,
        status=event.status.value,
        start_time=event.start_time,
        end_time=event.end_time,
        timezone=event.timezone,
        scoreboard_public=event.scoreboard_public,
        show_aws_console_button=event.show_aws_console_button,
        show_ssh_key_button=event.show_ssh_key_button,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )
