from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.deps import get_current_team_session
from app.models.team import Team
from app.models.event import Event
from app.schemas.team import TeamDashboard

router = APIRouter()


@router.get("/current", response_model=TeamDashboard)
async def get_current_team(
    session=Depends(get_current_team_session),
    db: AsyncSession = Depends(get_db),
):
    team_result = await db.execute(select(Team).where(Team.id == session.team_id))
    team = team_result.scalar_one()

    event_result = await db.execute(select(Event).where(Event.id == team.event_id))
    event = event_result.scalar_one()

    return TeamDashboard(
        team_id=str(team.id),
        public_team_id=team.public_team_id,
        team_name=team.team_name,
        encoded_team_id_base64=team.encoded_team_id_base64,
        challenge_token=team.challenge_token,
        score_total=team.score_total,
        trend_value=team.trend_value,
        rank_cache=team.rank_cache,
        event_id=str(event.id),
        public_event_id=event.public_event_id,
        event_title=event.title,
        event_status=event.status.value,
        event_start_time=event.start_time,
        event_end_time=event.end_time,
        scoreboard_public=event.scoreboard_public,
        root_url_detection_enabled=event.root_url_detection_enabled,
        shared_folder_enabled=event.shared_folder_enabled,
        show_aws_console_button=event.show_aws_console_button,
        show_ssh_key_button=event.show_ssh_key_button,
    )
